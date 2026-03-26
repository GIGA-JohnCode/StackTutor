import type { LLMClient } from "./LLMClient";
import type { StepItem, TopicItem, TutorMessage } from "../types/domain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ModelProvider, ModelTask } from "../providers/ModelProvider";
import {
  DECOMPOSE_SCHEMA,
  PREREQUISITE_SCHEMA,
  type DecomposeOutput,
  type PrerequisiteOutput,
} from "./schemas";

// LLM layer implementation.
// This class owns tutor operations and uses provider-supplied models underneath.
export class LangChainLLMClient implements LLMClient {
  private provider: ModelProvider;
  private modelCache: Partial<Record<ModelTask, BaseChatModel>> = {};

  constructor(provider: ModelProvider) {
    this.provider = provider;
  }

  async generatePrerequisites(input: {
    topic: TopicItem;
    maxItems: number;
    knownTopicsContext: string;
  }): Promise<PrerequisiteOutput> {
    const model = this.getTaskModel("prerequisite");
    const maxItems = this.normalizeMaxItems(input.maxItems);

    const systemPrompt = [
      "You generate immediate prerequisites for learning topics.",
      "The provided topic proficiency is the target end-state the learner wants to reach.",
      "Return only independent, immediate prerequisites and avoid deep or redundant chains.",
      `Return at most ${String(maxItems)} prerequisites.`,
      "Use the known-topics context to avoid suggesting topics the user already knows.",
    ].join("\n");

    const userPrompt = [
      `Target topic: ${input.topic.name}`,
      `Target topic proficiency: ${input.topic.proficiency}`,
      "Known topics context:",
      input.knownTopicsContext,
      "Output prerequisites only.",
    ].join("\n\n");

    const structuredModel = model.withStructuredOutput(PREREQUISITE_SCHEMA, {
      name: "prerequisite_list",
    });

    const output = await structuredModel.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const parsed = output as PrerequisiteOutput;
    if (!Array.isArray(parsed.prerequisites)) {
      throw new Error("Prerequisite generation payload is missing 'prerequisites' array");
    }

    const hasInvalidItem = parsed.prerequisites.some((item) => {
      return typeof item?.name !== "string" || typeof item?.proficiency !== "string";
    });
    if (hasInvalidItem) {
      throw new Error("Prerequisite generation payload contains invalid prerequisite items");
    }

    return parsed;
  }

  async decomposeTopic(input: {
    topic: TopicItem;
    stepCountHint?: number;
    knownTopicsContext: string;
  }): Promise<DecomposeOutput> {
    const model = this.getTaskModel("decompose");
    const stepCount = this.normalizeStepCount(input.stepCountHint);

    const systemPrompt = [
      "You decompose a learning topic into practical bite-sized objectives.",
      "The provided topic proficiency is the target end-state the learner wants to reach.",
      "Each step must include a short name and a detailed objective.",
      "Each objective should be concrete, ordered, and similar in size.",
      `Return around ${String(stepCount)} steps, with no duplicated objectives.`,
      "Use known-topics context to avoid spending steps on concepts the learner already knows well.",
    ].join("\n");

    const userPrompt = [
      `Topic: ${input.topic.name}`,
      `Target proficiency: ${input.topic.proficiency}`,
      "Known topics context:",
      input.knownTopicsContext,
      "Return an ordered list of steps.",
    ].join("\n\n");

    const structuredModel = model.withStructuredOutput(DECOMPOSE_SCHEMA, {
      name: "topic_decomposition",
    });

    const output = await structuredModel.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const parsed = output as DecomposeOutput;
    if (!Array.isArray(parsed.steps)) {
      throw new Error("Decompose topic payload is missing 'steps' array");
    }

    return parsed;
  }

  async completeStep(input: {
    topic: TopicItem;
    step: StepItem;
    mode: "initial" | "doubt";
    doubt?: string;
    history: TutorMessage[];
    knownTopicsContext: string;
  }): Promise<string> {
    const model = this.getTaskModel("teach");

    const systemPrompt = [
      "You are an adaptive AI tutor.",
      "Topic proficiency means the target level the learner wants after completing this topic.",
      "Depth and rigor should be adjusted to match the target proficiency and known-topics context.",
      "Explain clearly with concise examples and avoid unnecessary filler.",
    ].join("\n");

    const recentHistory = this.formatRecentHistory(input.history, 8);
    const modeDirective = input.mode === "doubt"
      ? "Mode: doubt clarification. Answer the learner's doubt without advancing the step."
      : "Mode: initial teaching. Teach the current step clearly and directly.";

    const userPrompt = [
      `Topic: ${input.topic.name}`,
      `Target proficiency: ${input.topic.proficiency}`,
      `Step name: ${input.step.name}`,
      `Step objective: ${input.step.objective}`,
      modeDirective,
      input.doubt ? `Learner doubt: ${input.doubt}` : "Learner doubt: none",
      "Known topics context:",
      input.knownTopicsContext,
      "Recent conversation history:",
      recentHistory,
    ].join("\n\n");

    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const content = this.extractModelText(response);
    if (!content) {
      throw new Error("Teaching response was empty");
    }

    return content;
  }

  private getTaskModel(task: ModelTask): BaseChatModel {
    const cached = this.modelCache[task];
    if (cached) {
      return cached;
    }

    const model = this.provider.getModel(task);
    this.modelCache[task] = model;
    return model;
  }

  private normalizeMaxItems(maxItems: number): number {
    if (!Number.isFinite(maxItems)) {
      return 5;
    }
    return Math.min(Math.max(Math.trunc(maxItems), 1), 8);
  }

  private normalizeStepCount(stepCountHint?: number): number {
    if (!Number.isFinite(stepCountHint)) {
      return 6;
    }
    return Math.min(Math.max(Math.trunc(stepCountHint ?? 0), 2), 12);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private formatRecentHistory(history: TutorMessage[], maxItems: number): string {
    if (history.length === 0) {
      return "No prior messages.";
    }

    const sliced = history.slice(-maxItems);
    return sliced
      .map((item) => `${item.role} | ${item.kind} | ${item.content}`)
      .join("\n");
  }

  private extractModelText(response: unknown): string {
    if (typeof response === "string") {
      return response.trim();
    }

    if (!this.isRecord(response)) {
      return "";
    }

    const content = response.content;
    if (typeof content === "string") {
      return content.trim();
    }

    if (!Array.isArray(content)) {
      return "";
    }

    return content
      .map((block) => {
        if (typeof block === "string") {
          return block;
        }
        if (this.isRecord(block) && typeof block.text === "string") {
          return block.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }
}
