import { TutorSession } from "./TutorSession";
import { getLogger } from "./logging/Logger";
import { KnowledgeStore } from "./knowledge/KnowledgeStore";
import type { KnowledgeValidator } from "./knowledge/KnowledgeValidator";
import type { LLMClient, TeachingTokenUpdate } from "./llm/LLMClient";
import { parseDecompositionSteps, parsePrerequisites } from "./llm/parsers";
import type {
  PendingPrerequisiteReview,
  StackItem,
  StepItem,
  TopicItem,
  TutorMessage,
  TutorSessionSnapshot,
} from "./types/domain";

const logger = getLogger("TutorEngine");

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

  startWithRootTopic(topic: string, proficiency: TopicItem["proficiency"], context?: string): void {
    const normalizedContext = context?.trim();
    logger.info("Starting root topic", { topic, proficiency, hasContext: Boolean(normalizedContext) });

    const root: StackItem = {
      id: `topic:${topic.toLowerCase()}`,
      topic: {
        name: topic,
        proficiency,
        context: normalizedContext || this.buildRootTopicContext(topic),
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
      logger.warn("Expand skipped: stack is empty");
      this.session.setStatus("completed");
      return [];
    }

    if (top.prerequisitesSearched || top.depth >= this.session.getSnapshot().maxDepth) {
      logger.debug("Expand skipped: prerequisites already searched or depth limit reached", {
        topicId: top.id,
        prerequisitesSearched: top.prerequisitesSearched,
        depth: top.depth,
      });
      return [];
    }

    const pending = this.session.getPendingPrerequisiteReview();
    if (pending && pending.parentTopicId === top.id) {
      logger.debug("Expand reused pending prerequisite review", { topicId: top.id, suggestedCount: pending.suggested.length });
      return pending.suggested;
    }

    logger.info("Generating prerequisites", { topicId: top.id, topic: top.topic.name, maxPrereqs });

    const rawOutput = await this.llmClient.generatePrerequisites({
      topic: top.topic,
      maxItems: maxPrereqs,
      knownTopicsContext: this.knowledgeStore.toLLMContext(),
      currentSessionStackTopicsContext: this.buildCurrentSessionStackTopicsContext(),
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

    logger.info("Generated prerequisites", { topicId: top.id, suggestedCount: validated.length });

    return validated;
  }

  applyAcceptedPrerequisites(parentTopicId: string, accepted: TopicItem[]): void {
    const pending = this.session.getPendingPrerequisiteReview();
    if (pending && pending.parentTopicId !== parentTopicId) {
      throw new Error("Pending prerequisite review does not match parent topic");
    }

  logger.info("Applying accepted prerequisites", { parentTopicId, acceptedCount: accepted.length });
    this.session.pushPrerequisitesAbove(parentTopicId, accepted);
    this.session.markPrerequisitesSearched(parentTopicId);
    this.session.setPendingPrerequisiteReview(null);
  }

  dismissPendingPrerequisites(parentTopicId: string): void {
    const pending = this.session.getPendingPrerequisiteReview();
    if (!pending) {
      logger.debug("Dismiss pending prerequisites skipped: no pending review", { parentTopicId });
      return;
    }

    if (pending.parentTopicId !== parentTopicId) {
      throw new Error("Pending prerequisite review does not match parent topic");
    }

    logger.info("Dismissing pending prerequisites", { parentTopicId, suggestedCount: pending.suggested.length });
    this.session.markPrerequisitesSearched(parentTopicId);
    this.session.setPendingPrerequisiteReview(null);
  }

  removeStackItem(itemId: string): void {
    logger.info("Removing stack item", { itemId });
    this.session.removeStackItem(itemId);

    const pending = this.session.getPendingPrerequisiteReview();
    if (pending && pending.parentTopicId === itemId) {
      this.session.setPendingPrerequisiteReview(null);
    }

    if (this.session.isStackEmpty()) {
      this.session.setStatus("completed");
    }
  }

  moveStackItem(fromIndex: number, toIndex: number): void {
    logger.info("Reordering stack item", { fromIndex, toIndex });
    this.session.reorderStack(fromIndex, toIndex);
  }

  removeUpcomingStep(topicId: string, stepId: string): void {
    const top = this.session.getTopStackItem();
    if (!top) {
      logger.error("Cannot remove step: no active topic", { topicId, stepId });
      throw new Error("No active topic to remove step from");
    }

    if (top.id !== topicId) {
      logger.warn("Cannot remove step: topic is not current top", { topicId, topTopicId: top.id, stepId });
      throw new Error("Only steps from the top topic can be removed");
    }

    logger.info("Removing upcoming step", { topicId, stepId });
    this.session.removeUpcomingStep(topicId, stepId);
  }

  async decomposeTopIfNeeded(stepCountHint?: number): Promise<StepItem[]> {
    const top = this.session.getTopStackItem();
    if (!top) {
      logger.warn("Decompose skipped: stack is empty");
      this.session.setStatus("completed");
      return [];
    }

    if (!this.isTopReadyToTeach(top)) {
      logger.debug("Decompose skipped: top is not ready to teach", {
        topicId: top.id,
        prerequisitesSearched: top.prerequisitesSearched,
        depth: top.depth,
      });
      return [];
    }

    if (top.steps.length > 0) {
      logger.debug("Decompose skipped: steps already exist", { topicId: top.id, stepCount: top.steps.length });
      return top.steps;
    }

    logger.info("Decomposing topic", { topicId: top.id, topic: top.topic.name, stepCountHint });

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
      logger.error("Decomposition produced no steps", { topicId: top.id });
      throw new Error("Topic decomposition returned no usable steps");
    }

    this.session.setSteps(top.id, parsedSteps);

    logger.info("Decomposition complete", { topicId: top.id, stepCount: parsedSteps.length });

    return parsedSteps;
  }

  async teachCurrentStep(
    mode: "initial" | "doubt",
    doubt?: string,
    onToken?: (update: TeachingTokenUpdate) => void,
  ): Promise<TutorMessage | null> {
    logger.debug("Teaching current step", { mode, hasDoubt: Boolean(doubt?.trim()) });
    const resolved = await this.resolveActiveTeachingTarget();
    if (!resolved) {
      logger.warn("Teach skipped: no active teaching target");
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
      onToken,
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
    logger.info("Teaching message appended", { topicId: top.id, stepId: step.id, kind });
    return message;
  }

  async retryCurrentStep(onToken?: (update: TeachingTokenUpdate) => void): Promise<TutorMessage | null> {
    logger.info("Retrying current step");
    const resolved = await this.resolveActiveTeachingTarget();
    if (!resolved) {
      logger.warn("Retry skipped: no active teaching target");
      return null;
    }

    const { top, step } = resolved;
    const content = await this.llmClient.completeStep({
      topic: top.topic,
      step,
      mode: "initial",
      history: this.session.getSnapshot().feed,
      knownTopicsContext: this.knowledgeStore.toLLMContext(),
      onToken,
    });

    const message = this.createTutorMessage({
      kind: "retry",
      topic: top.topic.name,
      step,
      prompt: step.objective,
      content,
    });

    this.session.appendMessage(message);
    logger.info("Retry message appended", { topicId: top.id, stepId: step.id });
    return message;
  }

  async askStepDoubt(
    question: string,
    onToken?: (update: TeachingTokenUpdate) => void,
  ): Promise<{ user: TutorMessage; tutor: TutorMessage } | null> {
    const trimmed = question.trim();
    if (!trimmed) {
      throw new Error("Doubt question cannot be empty");
    }

    logger.info("Handling step doubt", { questionLength: trimmed.length });

    const resolved = await this.resolveActiveTeachingTarget();
    if (!resolved) {
      logger.warn("Doubt skipped: no active teaching target");
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

    const tutorMessage = await this.teachCurrentStep("doubt", trimmed, onToken);
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
    logger.info("Proceeding current step");
    const top = this.session.getTopStackItem();
    if (!top) {
      logger.warn("Proceed ended session: stack is empty");
      this.session.setStatus("completed");
      return {
        advanced: false,
        sessionCompleted: true,
      };
    }

    if (top.steps.length === 0) {
      // If the top was manually changed (remove/reorder), let caller continue
      // into normal expansion/decompose/teach flow instead of hard failing.
      logger.debug("Proceed no-op: top has no steps yet", { topicId: top.id });
      return {
        advanced: false,
        sessionCompleted: false,
      };
    }

    const activeIndex = top.activeStepIndex;
    const activeStep = top.steps[activeIndex];
    if (!activeStep) {
      logger.error("Proceed failed: active step index out of range", {
        topicId: top.id,
        activeIndex,
        stepCount: top.steps.length,
      });
      throw new Error("Active step index is out of range");
    }

    this.session.markStepCompleted(top.id, activeIndex);
    const isLastStep = activeIndex >= top.steps.length - 1;

    if (!isLastStep) {
      this.session.incrementStep(top.id);
      logger.info("Advanced to next step", { topicId: top.id, fromStepIndex: activeIndex, toStepIndex: activeIndex + 1 });
      return {
        advanced: true,
        sessionCompleted: false,
      };
    }

    const completedTopic = top.topic;
    this.session.popTopStackItem();
    this.knowledgeStore.upsert(completedTopic.name, completedTopic.proficiency, completedTopic.context);
    logger.info("Completed topic and popped from stack", { topicId: top.id, topic: completedTopic.name });

    const pending = this.session.getPendingPrerequisiteReview();
    if (pending && pending.parentTopicId === top.id) {
      this.session.setPendingPrerequisiteReview(null);
    }

    const empty = this.session.isStackEmpty();
    this.session.setStatus(empty ? "completed" : "active");

    logger.info("Proceed completed topic", { sessionCompleted: empty });

    return {
      advanced: false,
      completedTopic,
      sessionCompleted: empty,
    };
  }

  private async resolveActiveTeachingTarget(): Promise<{ top: StackItem; step: StepItem } | null> {
    let top = this.session.getTopStackItem();
    if (!top) {
      logger.warn("Resolve target failed: stack is empty");
      this.session.setStatus("completed");
      return null;
    }

    if (!this.isTopReadyToTeach(top)) {
      logger.debug("Resolve target blocked: top not ready", {
        topicId: top.id,
        prerequisitesSearched: top.prerequisitesSearched,
        depth: top.depth,
      });
      return null;
    }

    if (top.steps.length === 0) {
      logger.debug("Resolve target: steps missing, triggering decomposition", { topicId: top.id });
      await this.decomposeTopIfNeeded();
      top = this.session.getTopStackItem();
      if (!top) {
        logger.warn("Resolve target failed after decomposition: stack became empty");
        this.session.setStatus("completed");
        return null;
      }
    }

    const step = top.steps[top.activeStepIndex];
    if (!step) {
      logger.error("Resolve target failed: active step index out of range", {
        topicId: top.id,
        activeStepIndex: top.activeStepIndex,
        stepCount: top.steps.length,
      });
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

  private buildRootTopicContext(topic: string): string {
    return `Learning scope focused on ${topic} and its direct practical usage.`;
  }

  private buildCurrentSessionStackTopicsContext(): string {
    const stack = this.session.getSnapshot().stack;
    if (stack.length === 0) {
      return "No current stack topics.";
    }

    const seen = new Set<string>();
    const uniqueTopics: string[] = [];

    for (const item of stack) {
      const normalized = item.topic.name.trim().replace(/\s+/g, " ");
      if (!normalized) {
        continue;
      }

      const lowered = normalized.toLowerCase();
      if (seen.has(lowered)) {
        continue;
      }

      seen.add(lowered);
      uniqueTopics.push(normalized);
    }

    if (uniqueTopics.length === 0) {
      return "No current stack topics.";
    }

    return uniqueTopics.map((name) => `- ${name}`).join("\n");
  }
}