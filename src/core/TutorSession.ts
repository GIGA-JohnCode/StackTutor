import {
  type SessionStatus,
  type StackItem,
  type StepItem,
  type TutorMessage,
  type TutorSessionSnapshot,
} from "./types/domain";

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
    });
  }

  static fromSnapshot(snapshot: TutorSessionSnapshot): TutorSession {
    // Rehydrate an existing session from repository data.
    return new TutorSession(snapshot);
  }

  getSnapshot(): TutorSessionSnapshot {
    return this.snapshot;
  }

  getStatus(): SessionStatus {
    return this.snapshot.status;
  }

  setStatus(status: SessionStatus): void {
    this.snapshot.status = status;
    this.touch();
  }

  setStack(stack: StackItem[]): void {
    this.snapshot.stack = stack;
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

  appendMessage(message: TutorMessage): void {
    this.snapshot.feed.push(message);
    this.touch();
  }

  private touch(): void {
    this.snapshot.updatedAt = new Date().toISOString();
  }
}