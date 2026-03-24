import type { LLMClient } from "./LLMClient";
import type { PrerequisiteCandidate, StepItem, TutorMessage } from "../types/domain";
import type { ModelProvider } from "../providers/ModelProvider";

// LLM layer implementation.
// This class owns tutor operations and uses provider-supplied models underneath.
export class LangChainLLMClient implements LLMClient {
  private provider: ModelProvider;

  constructor(provider: ModelProvider) {
    this.provider = provider;
  }

  async generatePrerequisites(_input: {
    topic: string;
    maxItems: number;
    depth: number;
    knownTopicsContext: string;
  }): Promise<PrerequisiteCandidate[]> {
    const model = this.provider.getModel("prerequisite");
    void _input;
    void model;
    throw new Error("LangChainLLMClient.generatePrerequisites is not implemented yet");
  }

  async decomposeTopic(_input: {
    topic: string;
    stepCountHint?: number;
  }): Promise<StepItem[]> {
    const model = this.provider.getModel("decompose");
    void _input;
    void model;
    throw new Error("LangChainLLMClient.decomposeTopic is not implemented yet");
  }

  async completeStep(_input: {
    topic: string;
    stepObjective: string;
    mode: "initial" | "doubt";
    doubt?: string;
    history: TutorMessage[];
  }): Promise<string> {
    const model = this.provider.getModel("teach");
    void _input;
    void model;
    throw new Error("LangChainLLMClient.completeStep is not implemented yet");
  }
}
