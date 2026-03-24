export interface AppSettings {
  // BYOK model provider, ex: groq.
  providerName: string;
  // User-supplied API key stored locally in browser for client-side calls.
  // NOTE: This is acceptable for BYOK but should never be hardcoded in source.
  apiKey?: string;
  modelName?: string;
}

// Repository contract for app-level settings.
export interface SettingsRepository {
  get(): AppSettings;
  save(settings: AppSettings): void;
}
