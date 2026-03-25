// Provider layer contract.
// A provider only configures and returns a model instance for a requested task.

export type ModelTask =
  | "default"
  | "chat"
  | "prerequisite"
  | "decompose"
  | "teach"
  | "summarize";

export interface ProviderConfig {
  apiKey?: string;
  modelName?: string;
}

// Keep this broad until a concrete LangChain model package is wired in.
export type ChatModelLike = unknown;

export interface ModelProvider {
  getModel(task?: ModelTask): ChatModelLike;
}
