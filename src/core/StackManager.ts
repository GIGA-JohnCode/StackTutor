import type { PrerequisiteCandidate, StackItem } from "./types/domain";

// Encapsulates all stack operations so UI cannot mutate stack structure directly.
export class StackManager {
  private stack: StackItem[];

  constructor(stack: StackItem[]) {
    this.stack = stack;
  }

  getStack(): StackItem[] {
    return this.stack;
  }

  peekTop(): StackItem | undefined {
    return this.stack[this.stack.length - 1];
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  pushItem(item: StackItem): void {
    this.stack.push(item);
  }

  popTop(): StackItem | undefined {
    return this.stack.pop();
  }

  // Inserts accepted prerequisites above the selected parent topic.
  pushPrerequisitesAbove(parentTopicId: string, prerequisites: PrerequisiteCandidate[]): void {
    const parentIndex = this.stack.findIndex((item) => item.id === parentTopicId);
    if (parentIndex < 0) {
      throw new Error("Parent topic not found in stack");
    }

    const parent = this.stack[parentIndex];
    const mapped: StackItem[] = prerequisites.map((candidate, idx) => ({
      id: `${parentTopicId}:prereq:${idx}:${candidate.topic.toLowerCase()}`,
      topic: {
        name: candidate.topic,
        proficiency: "beginner",
      },
      depth: parent.depth + 1,
      prerequisitesSearched: false,
      steps: [],
      activeStepIndex: 0,
    }));

    this.stack.splice(parentIndex + 1, 0, ...mapped);
  }

  // Supports user-driven reordering in the right sidebar.
  reorder(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.stack.length) {
      throw new Error("Invalid source index");
    }
    if (toIndex < 0 || toIndex >= this.stack.length) {
      throw new Error("Invalid target index");
    }

    const [moved] = this.stack.splice(fromIndex, 1);
    this.stack.splice(toIndex, 0, moved);
  }

  removeById(itemId: string): void {
    this.stack = this.stack.filter((item) => item.id !== itemId);
  }
}