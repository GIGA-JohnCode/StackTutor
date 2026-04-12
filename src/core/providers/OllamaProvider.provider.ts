import { ChatOllama } from "@langchain/ollama";
import { registerProvider } from "./ProviderFactory";
import { getLogger } from "../logging/Logger";
import type { ModelProvider, ModelTask, ProviderConfig } from "./ModelProvider";

const logger = getLogger("OllamaProvider");

// Provider only resolves model selection and initialization.
// Operation logic belongs to src/core/llm.
export class OllamaProvider implements ModelProvider {
  private config: ProviderConfig;

  private readonly modelByTask: Record<ModelTask, string> = {
    default: "llama3.2:3b",
    chat: "llama3.2:3b",
    prerequisite: "llama3.2:3b",
    decompose: "llama3.2:3b",
    teach: "llama3.2:3b",
    summarize: "llama3.2:3b",
  };

  constructor(config?: ProviderConfig) {
    this.config = config ?? {};
  }

  getModel(task: ModelTask = "default"): ChatOllama {
    const resolvedTask = this.modelByTask[task] ? task : "default";
    const configuredModel = this.config.modelName?.trim();
    const modelName = configuredModel || this.modelByTask[resolvedTask];
    const maybeBaseUrl = this.config.apiKey?.trim();

    logger.debug("Resolving model", {
      task,
      resolvedTask,
      modelName,
      hasCustomBaseUrl: Boolean(maybeBaseUrl),
    });

    if (!modelName || modelName.includes(" ")) {
      throw new Error(`Invalid Ollama model name '${modelName}'.`);
    }

    if (maybeBaseUrl && !this.looksLikeHttpUrl(maybeBaseUrl)) {
      throw new Error("Ollama base URL must start with http:// or https://.");
    }

    try {
      return new ChatOllama({
        model: modelName,
        baseUrl: maybeBaseUrl || undefined,
        temperature: 0.2,
        maxRetries: 2,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider initialization error";
      logger.error("Model initialization failed", { resolvedTask, modelName, message });
      throw new Error(
        `Failed to initialize Ollama model '${modelName}' for task '${resolvedTask}': ${message}`,
      );
    }
  }

  private looksLikeHttpUrl(value: string): boolean {
    return value.startsWith("http://") || value.startsWith("https://");
  }
}

// Register at module load time. The provider loader imports this file automatically.
registerProvider("ollama")(OllamaProvider);
