import { STORAGE_KEYS } from "./StorageKeys";
import { getLogger } from "../logging/Logger";
import type { AppSettings, SettingsRepository } from "./SettingsRepository";

const logger = getLogger("LocalSettingsRepository");

const DEFAULT_SETTINGS: AppSettings = {
  providerName: "groq",
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
      return {
        ...DEFAULT_SETTINGS,
        ...(JSON.parse(raw) as AppSettings),
      };
    } catch {
      logger.warn("Failed to parse settings; using defaults");
      return DEFAULT_SETTINGS;
    }
  }

  save(settings: AppSettings): void {
    logger.info("Saving settings", {
      providerName: settings.providerName,
      hasApiKey: Boolean(settings.apiKey?.trim()),
      hasModelName: Boolean(settings.modelName?.trim()),
    });
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }
}
