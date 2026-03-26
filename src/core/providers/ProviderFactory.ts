import type { ModelProvider, ProviderConfig } from "./ModelProvider";

// Runtime registry that mirrors your Python decorator-based auto-registration pattern.
type ProviderCtor = new (config?: ProviderConfig) => ModelProvider;

const providers = new Map<string, ProviderCtor>();

export function registerProvider(name: string) {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    throw new Error("Provider registration requires a non-empty name");
  }

  return function applyProviderRegistration(constructor: ProviderCtor): void {
    providers.set(normalizedName, constructor);
  };
}

export class ProviderFactory {
  static getProvider(name: string, config?: ProviderConfig): ModelProvider {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) {
      throw new Error("Provider name is required");
    }

    const ctor = providers.get(normalizedName);
    if (!ctor) {
      throw new Error(`Provider '${name}' is not registered`);
    }

    try {
      return new ctor(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider construction error";
      throw new Error(`Provider '${normalizedName}' failed to initialize: ${message}`);
    }
  }

  static getRegisteredNames(): string[] {
    return Array.from(providers.keys());
  }
}
