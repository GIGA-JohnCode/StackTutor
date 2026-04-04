import type { LLMClient } from "./LLMClient";
import type { StepItem, TopicItem, TutorMessage } from "../types/domain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ModelProvider, ModelTask } from "../providers/ModelProvider";
import { LLMOutputError } from "./LLMOutputError";
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
  private readonly retryAttempts = {
    structured: 2,
    teaching: 2,
  } as const;

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
      "Use topic context to keep the scope specific to the target application area.",
      "Each prerequisite must include a context field that explains what this prerequisite means in relation to the target topic, including what it relates to and what it does not cover.",
      "Return only independent, immediate prerequisites and avoid deep or redundant chains.",
      `Return at most ${String(maxItems)} prerequisites.`,
      "Use the known-topics context to avoid suggesting topics the user already knows.",
    ].join("\n");

    const userPrompt = [
      `Target topic: ${input.topic.name}`,
      `Target topic proficiency: ${input.topic.proficiency}`,
      `Target topic context: ${input.topic.context}`,
      "Known topics context:",
      input.knownTopicsContext,
      "Output prerequisites only.",
    ].join("\n\n");

    const structuredModel = model.withStructuredOutput(PREREQUISITE_SCHEMA, {
      name: "prerequisite_list",
    });

    return this.invokeWithRetry<PrerequisiteOutput>({
      attemptBudget: this.retryAttempts.structured,
      execute: (attempt) => structuredModel.invoke([
        {
          role: "system",
          content: attempt === 1
            ? systemPrompt
            : `${systemPrompt}\nYour previous response did not match the schema. Return only valid JSON with required fields.`,
        },
        { role: "user", content: userPrompt },
      ]),
      validate: (value) => (this.isPrerequisiteOutput(value) ? value : null),
      failureMessage: "Malformed prerequisite output after retry budget exhausted",
    });
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
      "Use the topic context to stay focused on the intended scope and avoid broad generic detours.",
      "Each step must include a short name and a detailed objective.",
      "Each objective should be concrete, ordered, and similar in size.",
      `Return around ${String(stepCount)} steps, with no duplicated objectives.`,
      "Use known-topics context to avoid spending steps on concepts the learner already knows well.",
    ].join("\n");

    const userPrompt = [
      `Topic: ${input.topic.name}`,
      `Target proficiency: ${input.topic.proficiency}`,
      `Topic context: ${input.topic.context}`,
      "Known topics context:",
      input.knownTopicsContext,
      "Return an ordered list of steps.",
    ].join("\n\n");

    const structuredModel = model.withStructuredOutput(DECOMPOSE_SCHEMA, {
      name: "topic_decomposition",
    });

    return this.invokeWithRetry<DecomposeOutput>({
      attemptBudget: this.retryAttempts.structured,
      execute: (attempt) => structuredModel.invoke([
        {
          role: "system",
          content: attempt === 1
            ? systemPrompt
            : `${systemPrompt}\nYour previous response did not match the schema. Return only valid JSON with required fields.`,
        },
        { role: "user", content: userPrompt },
      ]),
      validate: (value) => (this.isDecomposeOutput(value) ? value : null),
      failureMessage: "Malformed decompose output after retry budget exhausted",
    });
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
      `Topic context: ${input.topic.context}`,
      `Step name: ${input.step.name}`,
      `Step objective: ${input.step.objective}`,
      modeDirective,
      input.doubt ? `Learner doubt: ${input.doubt}` : "Learner doubt: none",
      "Known topics context:",
      input.knownTopicsContext,
      "Recent conversation history:",
      recentHistory,
    ].join("\n\n");

    return this.invokeWithRetry<string>({
      attemptBudget: this.retryAttempts.teaching,
      execute: (attempt) => model.invoke([
        {
          role: "system",
          content: attempt === 1
            ? systemPrompt
            : `${systemPrompt}\nYour previous response was empty. Return a concise teaching response now.`,
        },
        { role: "user", content: userPrompt },
      ]),
      validate: (value) => {
        const content = this.extractModelText(value);
        return content ? content : null;
      },
      failureMessage: "Teaching response was empty after retry budget exhausted",
    });
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

  private async invokeWithRetry<T>(input: {
    attemptBudget: number;
    execute: (attempt: number) => Promise<unknown>;
    validate: (value: unknown) => T | null;
    failureMessage: string;
  }): Promise<T> {
    const attempts = Math.max(1, Math.trunc(input.attemptBudget));

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const output = await input.execute(attempt);
      const validated = input.validate(output);
      if (validated !== null) {
        return validated;
      }

      if (attempt < attempts) {
        continue;
      }
    }

    throw new LLMOutputError(input.failureMessage);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private isProficiency(value: unknown): value is TopicItem["proficiency"] {
    return value === "beginner"
      || value === "intermediate"
      || value === "advanced"
      || value === "expert";
  }

  private isPrerequisiteOutput(value: unknown): value is PrerequisiteOutput {
    if (!this.isRecord(value) || !Array.isArray(value.prerequisites)) {
      return false;
    }

    return value.prerequisites.every((item) => {
      return this.isRecord(item)
        && typeof item.name === "string"
        && this.isProficiency(item.proficiency)
        && typeof item.context === "string";
    });
  }

  private isDecomposeOutput(value: unknown): value is DecomposeOutput {
    if (!this.isRecord(value) || !Array.isArray(value.steps)) {
      return false;
    }

    return value.steps.every((item) => {
      return this.isRecord(item)
        && typeof item.name === "string"
        && typeof item.objective === "string";
    });
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
