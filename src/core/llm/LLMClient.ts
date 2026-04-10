import type { StepItem, TopicItem, TutorMessage } from "../types/domain";
import type { DecomposeOutput, PrerequisiteOutput } from "./schemas";

export interface TeachingTokenUpdate {
  chunk: string;
  content: string;
}

// Tutor-operation contract used by the engine.
// Implementations may use LangChain and any registered model provider internally.
export interface LLMClient {
  generatePrerequisites(input: {
    topic: TopicItem;
    maxItems: number;
    knownTopicsContext: string;
    currentSessionStackTopicsContext: string;
  }): Promise<PrerequisiteOutput>;

  decomposeTopic(input: {
    topic: TopicItem;
    stepCountHint?: number;
    knownTopicsContext: string;
  }): Promise<DecomposeOutput>;

  // Completes a step in either initial teaching mode or doubt follow-up mode.
  completeStep(input: {
    topic: TopicItem;
    step: StepItem;
    mode: "initial" | "doubt";
    doubt?: string;
    history: TutorMessage[];
    knownTopicsContext: string;
    onToken?: (update: TeachingTokenUpdate) => void;
  }): Promise<string>;
}
