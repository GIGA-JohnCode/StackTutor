import { ChatOpenRouter } from "@langchain/openrouter";
import { registerProvider } from "./ProviderFactory";
import type { ModelProvider, ModelTask, ProviderConfig } from "./ModelProvider";

// Provider only resolves model selection and initialization.
// Operation logic belongs to src/core/llm.
export class OpenRouterProvider implements ModelProvider {
  private config: ProviderConfig;

  private readonly modelByTask: Record<ModelTask, string> = {
    default: "openrouter/free",
    chat: "openrouter/free",
    prerequisite: "openrouter/free",
    decompose: "openrouter/free",
    teach: "openrouter/free",
    summarize: "openrouter/free",
  };

  constructor(config?: ProviderConfig) {
    this.config = config ?? {};
  }

  getModel(task: ModelTask = "default"): ChatOpenRouter {
    const resolvedTask = this.modelByTask[task] ? task : "default";
    const configuredModel = this.config.modelName?.trim();
    const modelName = configuredModel || this.modelByTask[resolvedTask];
    const apiKey = this.config.apiKey?.trim();

    if (!apiKey) {
      throw new Error("OpenRouter provider requires a non-empty API key.");
    }

    if (!modelName || modelName.includes(" ")) {
      throw new Error(`Invalid OpenRouter model name '${modelName}'.`);
    }

    try {
      return new ChatOpenRouter({
        apiKey,
        model: modelName,
        temperature: 0.2,
        maxRetries: 2,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider initialization error";
      throw new Error(
        `Failed to initialize OpenRouter model '${modelName}' for task '${resolvedTask}': ${message}`,
      );
    }
  }
}

// Register at module load time. The provider loader imports this file automatically.
registerProvider("openrouter")(OpenRouterProvider);