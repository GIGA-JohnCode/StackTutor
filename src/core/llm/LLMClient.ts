import type { StepItem, TopicItem, TutorMessage } from "../types/domain";

// Tutor-operation contract used by the engine.
// Implementations may use LangChain and any registered model provider internally.
export interface LLMClient {
  generatePrerequisites(input: {
    topic: string;
    maxItems: number;
    depth: number;
    knownTopicsContext: string;
  }): Promise<TopicItem[]>;

  decomposeTopic(input: {
    topic: string;
    stepCountHint?: number;
  }): Promise<StepItem[]>;

  // Completes a step in either initial teaching mode or doubt follow-up mode.
  completeStep(input: {
    topic: string;
    stepObjective: string;
    mode: "initial" | "doubt";
    doubt?: string;
    history: TutorMessage[];
  }): Promise<string>;
}
