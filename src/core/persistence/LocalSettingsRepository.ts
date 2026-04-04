import { STORAGE_KEYS } from "./StorageKeys";
import { getLogger } from "../logging/Logger";
import type {
  AppSettings,
  ProviderCredentialSettings,
  SettingsRepository,
} from "./SettingsRepository";

const logger = getLogger("LocalSettingsRepository");

const DEFAULT_SETTINGS: AppSettings = {
  providerName: "groq",
  providerSettings: {},
};

// LocalStorage implementation for app settings.
export class LocalSettingsRepository implements SettingsRepository {
  get(): AppSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      logger.debug("Settings not found; using defaults");
      return DEFAULT_SETTINGS;
    }

    try {
      const parsed = JSON.parse(raw) as AppSettings;
      const providerName = this.normalizeProviderName(parsed.providerName);
      const providerSettings = this.normalizeProviderSettings(parsed.providerSettings);

      // Backward compatibility: lift legacy top-level credentials into provider-scoped settings.
      const legacyCredential = this.normalizeCredential({
        apiKey: parsed.apiKey,
        modelName: parsed.modelName,
      });
      if (legacyCredential && !providerSettings[providerName]) {
        providerSettings[providerName] = legacyCredential;
      }

      const activeCredential = providerSettings[providerName];

      return {
        providerName,
        apiKey: activeCredential?.apiKey,
        modelName: activeCredential?.modelName,
        providerSettings,
      };
    } catch {
      logger.warn("Failed to parse settings; using defaults");
      return DEFAULT_SETTINGS;
    }
  }

  save(settings: AppSettings): void {
    const providerName = this.normalizeProviderName(settings.providerName);
    const providerSettings = this.normalizeProviderSettings(settings.providerSettings);
    const activeCredential = this.normalizeCredential({
      apiKey: settings.apiKey,
      modelName: settings.modelName,
    });

    if (activeCredential) {
      providerSettings[providerName] = activeCredential;
    } else {
      delete providerSettings[providerName];
    }

    const normalized: AppSettings = {
      providerName,
      apiKey: providerSettings[providerName]?.apiKey,
      modelName: providerSettings[providerName]?.modelName,
      providerSettings,
    };

    logger.info("Saving settings", {
      providerName: normalized.providerName,
      hasApiKey: Boolean(normalized.apiKey?.trim()),
      hasModelName: Boolean(normalized.modelName?.trim()),
      configuredProviderCount: Object.keys(providerSettings).length,
    });
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(normalized));
  }

  private normalizeProviderName(name?: string): string {
    const normalized = name?.trim().toLowerCase();
    return normalized || DEFAULT_SETTINGS.providerName;
  }

  private normalizeProviderSettings(
    settings: AppSettings["providerSettings"],
  ): Record<string, ProviderCredentialSettings> {
    if (!settings) {
      return {};
    }

    return Object.entries(settings).reduce<Record<string, ProviderCredentialSettings>>((acc, [provider, credential]) => {
      const normalizedProvider = provider.trim().toLowerCase();
      if (!normalizedProvider) {
        return acc;
      }

      const normalizedCredential = this.normalizeCredential(credential);
      if (normalizedCredential) {
        acc[normalizedProvider] = normalizedCredential;
      }

      return acc;
    }, {});
  }

  private normalizeCredential(
    credential?: ProviderCredentialSettings,
  ): ProviderCredentialSettings | null {
    if (!credential) {
      return null;
    }

    const apiKey = credential.apiKey?.trim();
    const modelName = credential.modelName?.trim();

    if (!apiKey && !modelName) {
      return null;
    }

    return {
      apiKey: apiKey || undefined,
      modelName: modelName || undefined,
    };
  }
}
