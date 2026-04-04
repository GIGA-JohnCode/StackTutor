// Provider layer contract.
// A provider only configures and returns a model instance for a requested task.

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

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

export interface ModelProvider {
  getModel(task?: ModelTask): BaseChatModel;
}
