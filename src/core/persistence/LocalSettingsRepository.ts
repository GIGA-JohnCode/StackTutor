import { STORAGE_KEYS } from "./StorageKeys";
import type { AppSettings, SettingsRepository } from "./SettingsRepository";

const DEFAULT_SETTINGS: AppSettings = {
  providerName: "groq",
};

// LocalStorage implementation for app settings.
export class LocalSettingsRepository implements SettingsRepository {
  get(): AppSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    try {
      return {
        ...DEFAULT_SETTINGS,
        ...(JSON.parse(raw) as AppSettings),
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  save(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }
}
