export interface ProviderCredentialSettings {
  apiKey?: string;
  modelName?: string;
}

export interface AppSettings {
  // BYOK model provider, ex: groq.
  providerName: string;
  // User-supplied API key stored locally in browser for client-side calls.
  // NOTE: This is acceptable for BYOK but should never be hardcoded in source.
  apiKey?: string;
  modelName?: string;
  // Provider-scoped credentials to preserve keys/models across provider switches.
  providerSettings?: Record<string, ProviderCredentialSettings>;
}

// Repository contract for app-level settings.
export interface SettingsRepository {
  get(): AppSettings;
  save(settings: AppSettings): void;
}
