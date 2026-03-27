import { TutorSession } from "./TutorSession";
import { KnowledgeStore } from "./knowledge/KnowledgeStore";
import type { KnowledgeValidator } from "./knowledge/KnowledgeValidator";
import type { LLMClient } from "./llm/LLMClient";
import { parseDecompositionSteps, parsePrerequisites } from "./llm/parsers";
import type {
  PendingPrerequisiteReview,
  StackItem,
  StepItem,
  TopicItem,
  TutorMessage,
  TutorSessionSnapshot,
} from "./types/domain";

// Deterministic orchestration engine for the tutor workflow.
// This is the heart of business logic and should remain UI-framework agnostic.
export class TutorEngine {
  private session: TutorSession;
  private llmClient: LLMClient;
  private validator: KnowledgeValidator;
  private knowledgeStore: KnowledgeStore;

  constructor(
    session: TutorSession,
    llmClient: LLMClient,
    validator: KnowledgeValidator,
    knowledgeStore: KnowledgeStore,
  ) {
    this.session = session;
    this.llmClient = llmClient;
    this.validator = validator;
    this.knowledgeStore = knowledgeStore;
  }

  startWithRootTopic(topic: string, proficiency: TopicItem["proficiency"]): void {
    const root: StackItem = {
      id: `topic:${topic.toLowerCase()}`,
      topic: {
        name: topic,
        proficiency,
      },
      depth: 0,
      prerequisitesSearched: false,
      steps: [],
      activeStepIndex: 0,
    };

    this.session.setStack([root]);
    this.session.setStatus("active");
  }

  getSessionSnapshot(): Readonly<TutorSessionSnapshot> {
    return this.session.getSnapshot();
  }

  getPendingPrerequisiteReview(): PendingPrerequisiteReview | null {
    return this.session.getPendingPrerequisiteReview();
  }

  async expandTopIfNeeded(maxPrereqs = 5): Promise<TopicItem[]> {
    const top = this.session.getTopStackItem();

    if (!top) {
      this.session.setStatus("completed");
      return [];
    }

    if (top.prerequisitesSearched || top.depth >= this.session.getSnapshot().maxDepth) {
      return [];
    }

    const pending = this.session.getPendingPrerequisiteReview();
    if (pending && pending.parentTopicId === top.id) {
      return pending.suggested;
    }

    const rawOutput = await this.llmClient.generatePrerequisites({
      topic: top.topic,
      maxItems: maxPrereqs,
      knownTopicsContext: this.knowledgeStore.toLLMContext(),
    });

    const generated = parsePrerequisites(rawOutput, {
      targetTopic: top.topic.name,
      maxItems: maxPrereqs,
    });

    const validated = this.validator.validatePrerequisites(generated);

    this.session.setPendingPrerequisiteReview({
      parentTopicId: top.id,
      parentTopic: top.topic,
      suggested: validated,
      createdAt: new Date().toISOString(),
    });

    return validated;
  }

  applyAcceptedPrerequisites(parentTopicId: string, accepted: TopicItem[]): void {
    const pending = this.session.getPendingPrerequisiteReview();
    if (pending && pending.parentTopicId !== parentTopicId) {
      throw new Error("Pending prerequisite review does not match parent topic");
    }

    this.session.pushPrerequisitesAbove(parentTopicId, accepted);
    this.session.markPrerequisitesSearched(parentTopicId);
    this.session.setPendingPrerequisiteReview(null);
  }

  dismissPendingPrerequisites(parentTopicId: string): void {
    const pending = this.session.getPendingPrerequisiteReview();
    if (!pending) {
      return;
    }

    if (pending.parentTopicId !== parentTopicId) {
      throw new Error("Pending prerequisite review does not match parent topic");
    }

    this.session.markPrerequisitesSearched(parentTopicId);
    this.session.setPendingPrerequisiteReview(null);
  }

  async decomposeTopIfNeeded(stepCountHint?: number): Promise<StepItem[]> {
    const top = this.session.getTopStackItem();
    if (!top) {
      this.session.setStatus("completed");
      return [];
    }

    if (!this.isTopReadyToTeach(top)) {
      return [];
    }

    if (top.steps.length > 0) {
      return top.steps;
    }

    const rawOutput = await this.llmClient.decomposeTopic({
      topic: top.topic,
      stepCountHint,
      knownTopicsContext: this.knowledgeStore.toLLMContext(),
    });

    const parsedSteps = parseDecompositionSteps(rawOutput, {
      topic: top.topic,
      maxItems: this.normalizeStepCountHint(stepCountHint),
    });

    if (parsedSteps.length === 0) {
      throw new Error("Topic decomposition returned no usable steps");
    }

    this.session.setSteps(top.id, parsedSteps);

    return parsedSteps;
  }

  async teachCurrentStep(mode: "initial" | "doubt", doubt?: string): Promise<TutorMessage | null> {
    const resolved = await this.resolveActiveTeachingTarget();
    if (!resolved) {
      return null;
    }

    const { top, step } = resolved;
    const history = this.session.getSnapshot().feed;
    const content = await this.llmClient.completeStep({
      topic: top.topic,
      step,
      mode,
      doubt,
      history,
      knownTopicsContext: this.knowledgeStore.toLLMContext(),
    });

    const kind = mode === "doubt" ? "doubt" : "lesson";
    const message = this.createTutorMessage({
      kind,
      topic: top.topic.name,
      step,
      prompt: doubt ? `Doubt: ${doubt}` : step.objective,
      content,
    });

    this.session.appendMessage(message);
    return message;
  }

  async retryCurrentStep(): Promise<TutorMessage | null> {
    const resolved = await this.resolveActiveTeachingTarget();
    if (!resolved) {
      return null;
    }

    const { top, step } = resolved;
    const content = await this.llmClient.completeStep({
      topic: top.topic,
      step,
      mode: "initial",
      history: this.session.getSnapshot().feed,
      knownTopicsContext: this.knowledgeStore.toLLMContext(),
    });

    const message = this.createTutorMessage({
      kind: "retry",
      topic: top.topic.name,
      step,
      prompt: step.objective,
      content,
    });

    this.session.appendMessage(message);
    return message;
  }

  async askStepDoubt(question: string): Promise<{ user: TutorMessage; tutor: TutorMessage } | null> {
    const trimmed = question.trim();
    if (!trimmed) {
      throw new Error("Doubt question cannot be empty");
    }

    const resolved = await this.resolveActiveTeachingTarget();
    if (!resolved) {
      return null;
    }

    const { top, step } = resolved;
    const userMessage: TutorMessage = {
      id: this.newMessageId(),
      role: "user",
      kind: "doubt",
      topic: top.topic.name,
      prompt: trimmed,
      content: trimmed,
      createdAt: new Date().toISOString(),
      stepId: step.id,
    };

    this.session.appendMessage(userMessage);

    const tutorMessage = await this.teachCurrentStep("doubt", trimmed);
    if (!tutorMessage) {
      throw new Error("Failed to produce tutor response for doubt");
    }

    return {
      user: userMessage,
      tutor: tutorMessage,
    };
  }

  proceedCurrentStep(): {
    advanced: boolean;
    completedTopic?: TopicItem;
    sessionCompleted: boolean;
  } {
    const top = this.session.getTopStackItem();
    if (!top) {
      this.session.setStatus("completed");
      return {
        advanced: false,
        sessionCompleted: true,
      };
    }

    if (top.steps.length === 0) {
      throw new Error("Cannot proceed before decomposition and teaching");
    }

    const activeIndex = top.activeStepIndex;
    const activeStep = top.steps[activeIndex];
    if (!activeStep) {
      throw new Error("Active step index is out of range");
    }

    this.session.markStepCompleted(top.id, activeIndex);
    const isLastStep = activeIndex >= top.steps.length - 1;

    if (!isLastStep) {
      this.session.incrementStep(top.id);
      return {
        advanced: true,
        sessionCompleted: false,
      };
    }

    const completedTopic = top.topic;
    this.session.popTopStackItem();
    this.knowledgeStore.upsert(completedTopic.name, completedTopic.proficiency);

    const pending = this.session.getPendingPrerequisiteReview();
    if (pending && pending.parentTopicId === top.id) {
      this.session.setPendingPrerequisiteReview(null);
    }

    const empty = this.session.isStackEmpty();
    this.session.setStatus(empty ? "completed" : "active");

    return {
      advanced: false,
      completedTopic,
      sessionCompleted: empty,
    };
  }

  private async resolveActiveTeachingTarget(): Promise<{ top: StackItem; step: StepItem } | null> {
    let top = this.session.getTopStackItem();
    if (!top) {
      this.session.setStatus("completed");
      return null;
    }

    if (!this.isTopReadyToTeach(top)) {
      return null;
    }

    if (top.steps.length === 0) {
      await this.decomposeTopIfNeeded();
      top = this.session.getTopStackItem();
      if (!top) {
        this.session.setStatus("completed");
        return null;
      }
    }

    const step = top.steps[top.activeStepIndex];
    if (!step) {
      throw new Error("Active step index is out of range");
    }

    return { top, step };
  }

  private isTopReadyToTeach(top: StackItem): boolean {
    return top.prerequisitesSearched || top.depth >= this.session.getSnapshot().maxDepth;
  }

  private normalizeStepCountHint(stepCountHint?: number): number {
    if (!Number.isFinite(stepCountHint)) {
      return 6;
    }

    return Math.min(Math.max(Math.trunc(stepCountHint ?? 0), 2), 12);
  }

  private createTutorMessage(input: {
    kind: TutorMessage["kind"];
    topic: string;
    step: StepItem;
    prompt: string;
    content: string;
  }): TutorMessage {
    return {
      id: this.newMessageId(),
      role: "tutor",
      kind: input.kind,
      topic: input.topic,
      prompt: input.prompt,
      content: input.content,
      createdAt: new Date().toISOString(),
      stepId: input.step.id,
    };
  }

  private newMessageId(): string {
    return `msg:${crypto.randomUUID()}`;
  }
}