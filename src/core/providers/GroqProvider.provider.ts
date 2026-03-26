import { ChatGroq } from "@langchain/groq";
import { registerProvider } from "./ProviderFactory";
import type { ModelProvider, ModelTask, ProviderConfig } from "./ModelProvider";

// Provider only resolves model selection and initialization.
// Operation logic belongs to src/core/llm.
export class GroqProvider implements ModelProvider {
  private config: ProviderConfig;

  private readonly modelByTask: Record<ModelTask, string> = {
    default: "llama-3.3-70b-versatile",
    chat: "llama-3.3-70b-versatile",
    prerequisite: "llama-3.1-8b-instant",
    decompose: "llama-3.1-8b-instant",
    teach: "llama-3.3-70b-versatile",
    summarize: "llama-3.1-8b-instant",
  };

  constructor(config?: ProviderConfig) {
    this.config = config ?? {};
  }

  getModel(task: ModelTask = "default"): ChatGroq {
    const resolvedTask = this.modelByTask[task] ? task : "default";
    const configuredModel = this.config.modelName?.trim();
    const modelName = configuredModel || this.modelByTask[resolvedTask];
    const apiKey = this.config.apiKey?.trim();

    if (!apiKey) {
      throw new Error("Groq provider requires a non-empty API key.");
    }

    if (!modelName || modelName.includes(" ")) {
      throw new Error(`Invalid Groq model name '${modelName}'.`);
    }

    try {
      return new ChatGroq({
        apiKey,
        model: modelName,
        temperature: 0.2,
        maxRetries: 2,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider initialization error";
      throw new Error(
        `Failed to initialize Groq model '${modelName}' for task '${resolvedTask}': ${message}`,
      );
    }
  }
}

// Register at module load time. The provider loader imports this file automatically.
registerProvider("groq")(GroqProvider);