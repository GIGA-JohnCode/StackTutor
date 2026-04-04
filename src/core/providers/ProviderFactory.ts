import type { ModelProvider, ProviderConfig } from "./ModelProvider";
import { getLogger } from "../logging/Logger";

// Runtime registry that mirrors your Python decorator-based auto-registration pattern.
type ProviderCtor = new (config?: ProviderConfig) => ModelProvider;

const providers = new Map<string, ProviderCtor>();
const logger = getLogger("ProviderFactory");

export function registerProvider(name: string) {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    throw new Error("Provider registration requires a non-empty name");
  }

  return function applyProviderRegistration(constructor: ProviderCtor): void {
    logger.info("Registering provider", { name: normalizedName });
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
      logger.error("Provider lookup failed", { requestedName: name, normalizedName });
      throw new Error(`Provider '${name}' is not registered`);
    }

    try {
      logger.info("Creating provider instance", {
        providerName: normalizedName,
        hasApiKey: Boolean(config?.apiKey?.trim()),
        modelName: config?.modelName,
      });
      return new ctor(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider construction error";
      logger.error("Provider initialization failed", { providerName: normalizedName, message });
      throw new Error(`Provider '${normalizedName}' failed to initialize: ${message}`);
    }
  }

  static getRegisteredNames(): string[] {
    return Array.from(providers.keys());
  }
}
