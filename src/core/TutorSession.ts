import {
  type PendingPrerequisiteReview,
  type SessionStatus,
  type StackItem,
  type StepItem,
  type TopicItem,
  type TutorMessage,
  type TutorSessionSnapshot,
} from "./types/domain";
import { StackManager } from "./StackManager";

// Aggregate root for one learning session.
// Keeps domain state and exposes intent-based mutations.
export class TutorSession {
  private snapshot: TutorSessionSnapshot;

  private constructor(snapshot: TutorSessionSnapshot) {
    this.snapshot = snapshot;
  }

  static createNew(id: string, title: string, maxDepth: number): TutorSession {
    const now = new Date().toISOString();
    return new TutorSession({
      id,
      title,
      status: "active",
      maxDepth,
      createdAt: now,
      updatedAt: now,
      stack: [],
      feed: [],
      pendingPrerequisiteReview: null,
    });
  }

  static fromSnapshot(snapshot: TutorSessionSnapshot): TutorSession {
    // Rehydrate an existing session from repository data.
    const normalizedStack = snapshot.stack.map((item) => ({
      ...item,
      topic: normalizeTopicContext(item.topic),
    }));

    const normalizedPending = snapshot.pendingPrerequisiteReview
      ? {
        ...snapshot.pendingPrerequisiteReview,
        parentTopic: normalizeTopicContext(snapshot.pendingPrerequisiteReview.parentTopic),
        suggested: snapshot.pendingPrerequisiteReview.suggested.map((item) => normalizeTopicContext(item)),
      }
      : null;

    return new TutorSession({
      ...snapshot,
      stack: normalizedStack,
      pendingPrerequisiteReview: normalizedPending,
    });
  }

  // TODO: This is only a compile-time readonly view; runtime mutation is still possible via nested references.
  getSnapshot(): Readonly<TutorSessionSnapshot> {
    return this.snapshot;
  }

  getStatus(): SessionStatus {
    return this.snapshot.status;
  }

  getTopStackItem(): StackItem | undefined {
    // TODO: StackManager currently operates on the same underlying stack reference; revisit structural immutability guarantees.
    const stackManager = new StackManager(this.snapshot.stack);
    return stackManager.peekTop();
  }

  isStackEmpty(): boolean {
    const stackManager = new StackManager(this.snapshot.stack);
    return stackManager.isEmpty();
  }

  setStatus(status: SessionStatus): void {
    this.snapshot.status = status;
    this.touch();
  }

  setStack(stack: StackItem[]): void {
    this.snapshot.stack = stack;
    this.touch();
  }

  getPendingPrerequisiteReview(): PendingPrerequisiteReview | null {
    return this.snapshot.pendingPrerequisiteReview;
  }

  setPendingPrerequisiteReview(review: PendingPrerequisiteReview | null): void {
    this.snapshot.pendingPrerequisiteReview = review;
    this.touch();
  }

  markPrerequisitesSearched(topicId: string): void {
    const topic = this.snapshot.stack.find((item) => item.id === topicId);
    if (!topic) {
      throw new Error("Cannot mark prerequisites searched for missing stack topic");
    }

    topic.prerequisitesSearched = true;
    this.touch();
  }

  pushPrerequisitesAbove(parentTopicId: string, accepted: TopicItem[]): void {
    const stackManager = new StackManager(this.snapshot.stack);
    stackManager.pushPrerequisitesAbove(parentTopicId, accepted);
    this.snapshot.stack = stackManager.getStack();
    this.touch();
  }

  popTopStackItem(): StackItem | undefined {
    const stackManager = new StackManager(this.snapshot.stack);
    const popped = stackManager.popTop();
    this.snapshot.stack = stackManager.getStack();
    this.touch();
    return popped;
  }

  reorderStack(fromIndex: number, toIndex: number): void {
    const stackManager = new StackManager(this.snapshot.stack);
    stackManager.reorder(fromIndex, toIndex);
    this.snapshot.stack = stackManager.getStack();
    this.touch();
  }

  removeStackItem(itemId: string): void {
    const stackManager = new StackManager(this.snapshot.stack);
    stackManager.removeById(itemId);
    this.snapshot.stack = stackManager.getStack();
    this.touch();
  }

  setSteps(topicId: string, steps: StepItem[]): void {
    const topic = this.snapshot.stack.find((item) => item.id === topicId);
    if (!topic) {
      throw new Error("Cannot set steps for missing stack topic");
    }

    topic.steps = steps;
    topic.activeStepIndex = 0;
    this.touch();
  }

  incrementStep(topicId: string): void {
    const topic = this.snapshot.stack.find((item) => item.id === topicId);
    if (!topic) {
      throw new Error("Cannot advance step for missing stack topic");
    }

    topic.activeStepIndex += 1;
    this.touch();
  }

  markStepCompleted(topicId: string, stepIndex: number): void {
    const topic = this.snapshot.stack.find((item) => item.id === topicId);
    if (!topic) {
      throw new Error("Cannot complete step for missing stack topic");
    }

    const step = topic.steps[stepIndex];
    if (!step) {
      throw new Error("Cannot complete missing step index");
    }

    step.completed = true;
    this.touch();
  }

  removeUpcomingStep(topicId: string, stepId: string): void {
    const topic = this.snapshot.stack.find((item) => item.id === topicId);
    if (!topic) {
      throw new Error("Cannot remove step for missing stack topic");
    }

    const stepIndex = topic.steps.findIndex((step) => step.id === stepId);
    if (stepIndex < 0) {
      throw new Error("Cannot remove missing step");
    }

    if (stepIndex <= topic.activeStepIndex) {
      throw new Error("Only upcoming steps can be removed");
    }

    if (topic.steps[stepIndex]?.completed) {
      throw new Error("Completed steps cannot be removed");
    }

    topic.steps.splice(stepIndex, 1);
    this.touch();
  }

  appendMessage(message: TutorMessage): void {
    this.snapshot.feed.push(message);
    this.touch();
  }

  private touch(): void {
    this.snapshot.updatedAt = new Date().toISOString();
  }
}

function normalizeTopicContext(topic: TopicItem): TopicItem {
  const normalized = topic.context?.trim().replace(/\s+/g, " ") ?? "";
  if (normalized) {
    return {
      ...topic,
      context: normalized,
    };
  }

  return {
    ...topic,
    context: `General context for ${topic.name}`,
  };
}