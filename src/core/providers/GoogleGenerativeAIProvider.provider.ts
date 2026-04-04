import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { registerProvider } from "./ProviderFactory";
import { getLogger } from "../logging/Logger";
import type { ModelProvider, ModelTask, ProviderConfig } from "./ModelProvider";

const logger = getLogger("GoogleProvider");

// Provider only resolves model selection and initialization.
// Operation logic belongs to src/core/llm.
export class GoogleGenerativeAIProvider implements ModelProvider {
  private config: ProviderConfig;

  private readonly modelByTask: Record<ModelTask, string> = {
    default: "gemini-3.1-flash-lite-preview",
    chat: "gemini-3.1-flash-lite-preview",
    prerequisite: "gemini-3.1-flash-lite-preview",
    decompose: "gemini-3.1-flash-lite-preview",
    teach: "gemini-3.1-flash-lite-preview",
    summarize: "gemini-3.1-flash-lite-preview",
  };

  constructor(config?: ProviderConfig) {
    this.config = config ?? {};
  }

  getModel(task: ModelTask = "default"): ChatGoogleGenerativeAI {
    const resolvedTask = this.modelByTask[task] ? task : "default";
    const configuredModel = this.config.modelName?.trim();
    const modelName = configuredModel || this.modelByTask[resolvedTask];
    const apiKey = this.config.apiKey?.trim();

    logger.debug("Resolving model", { task, resolvedTask, modelName, hasApiKey: Boolean(apiKey) });

    if (!apiKey) {
      throw new Error("Google provider requires a non-empty API key.");
    }

    if (!modelName || modelName.includes(" ")) {
      throw new Error(`Invalid Google model name '${modelName}'.`);
    }

    try {
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: modelName,
        temperature: 0.2,
        maxRetries: 2,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider initialization error";
      logger.error("Model initialization failed", { resolvedTask, modelName, message });
      throw new Error(
        `Failed to initialize Google model '${modelName}' for task '${resolvedTask}': ${message}`,
      );
    }
  }
}

// Register at module load time. The provider loader imports this file automatically.
registerProvider("google")(GoogleGenerativeAIProvider);