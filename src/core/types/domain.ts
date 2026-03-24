// Shared domain contracts used across engine, UI, and persistence layers.

export type SessionStatus = "idle" | "active" | "paused" | "completed";

export type ProficiencyLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type MessageRole = "system" | "tutor" | "user";

export type MessageKind =
  | "instruction"
  | "lesson"
  | "doubt"
  | "retry";

export interface TopicItem {
  name: string;
  proficiency: ProficiencyLevel;
}

export interface KnowledgeEntry {
  // Topic metadata stored in one object for consistency across the domain.
  topic: TopicItem;
  confidence?: number;
  lastReviewedAt?: string;
}

export interface StackItem {
  id: string;
  topic: TopicItem;
  depth: number;
  // True after the topic has already been expanded into prerequisites.
  prerequisitesSearched: boolean;
  // Step plan and pointer are kept on the stack item to avoid split state maps.
  steps: StepItem[];
  activeStepIndex: number;
}

export interface StepItem {
  id: string;
  objective: string;
  completed: boolean;
}

export interface TutorMessage {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  topic: string;
  prompt: string;
  content: string;
  createdAt: string;
  stepId?: string;
}

export interface TutorSessionSnapshot {
  id: string;
  title: string;
  status: SessionStatus;
  maxDepth: number;
  createdAt: string;
  updatedAt: string;
  stack: StackItem[];
  feed: TutorMessage[];
}

export interface PrerequisiteCandidate {
  topic: string;
  rationale?: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  status: SessionStatus;
  updatedAt: string;
}