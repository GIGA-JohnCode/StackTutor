import { registerProvider } from "./ProviderFactory";
import type { ChatModelLike, ModelProvider, ModelTask, ProviderConfig } from "./ModelProvider";

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

  getModel(task: ModelTask = "default"): ChatModelLike {
    const resolvedTask = this.modelByTask[task] ? task : "default";
    const modelName = this.config.modelName ?? this.modelByTask[resolvedTask];

    // TODO: Replace this placeholder with actual LangChain ChatGroq initialization.
    // Example target shape once dependencies are wired:
    // return new ChatGroq({ model: modelName, apiKey, temperature: 0.7 });
    return {
      provider: "groq",
      model: modelName,
      apiKey: this.config.apiKey,
      hasApiKey: Boolean(this.config.apiKey?.trim()),
    };
  }
}

// Register at module load time. The provider loader imports this file automatically.
registerProvider("groq")(GroqProvider);