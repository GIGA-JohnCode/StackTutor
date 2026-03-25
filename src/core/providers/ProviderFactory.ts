import type { ModelProvider, ProviderConfig } from "./ModelProvider";

// Runtime registry that mirrors your Python decorator-based auto-registration pattern.
type ProviderCtor = new (config?: ProviderConfig) => ModelProvider;

const providers = new Map<string, ProviderCtor>();

export function registerProvider(name: string) {
  return function applyProviderRegistration(constructor: ProviderCtor): void {
    providers.set(name.toLowerCase(), constructor);
  };
}

export class ProviderFactory {
  static getProvider(name: string, config?: ProviderConfig): ModelProvider {
    const ctor = providers.get(name.toLowerCase());
    if (!ctor) {
      throw new Error(`Provider '${name}' is not registered`);
    }
    return new ctor(config);
  }

  static getRegisteredNames(): string[] {
    return Array.from(providers.keys());
  }
}
