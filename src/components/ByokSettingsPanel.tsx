import { useState } from "react";
import type { AppSettings } from "../core/persistence/SettingsRepository";

type ProviderSettingsMap = NonNullable<AppSettings["providerSettings"]>;

interface ByokSettingsPanelProps {
  initialSettings: AppSettings;
  providerOptions: string[];
  onSave: (settings: AppSettings) => void;
  showHeader?: boolean;
}

// Scaffold-only BYOK form. This persists user settings but does not validate keys against the API yet.
export function ByokSettingsPanel(props: ByokSettingsPanelProps) {
  const { initialSettings, providerOptions, onSave, showHeader = true } = props;
  const normalizedProviderOptions = providerOptions.length > 0 ? providerOptions : ["groq"];
  const normalizedInitialProvider = initialSettings.providerName.trim().toLowerCase();
  const resolvedInitialProvider = normalizedProviderOptions.includes(normalizedInitialProvider)
    ? normalizedInitialProvider
    : normalizedProviderOptions[0];

  const createInitialProviderSettings = (): ProviderSettingsMap => {
    const fromSettings = initialSettings.providerSettings ?? {};
    const normalized = Object.entries(fromSettings).reduce<ProviderSettingsMap>((acc, [provider, config]) => {
      const providerName = provider.trim().toLowerCase();
      if (!providerName) {
        return acc;
      }

      const apiKey = config?.apiKey?.trim();
      const modelName = config?.modelName?.trim();
      if (!apiKey && !modelName) {
        return acc;
      }

      acc[providerName] = {
        apiKey: apiKey || undefined,
        modelName: modelName || undefined,
      };

      return acc;
    }, {});

    // Backward compatibility in UI state: preserve legacy single-provider values.
    const legacyApiKey = initialSettings.apiKey?.trim();
    const legacyModelName = initialSettings.modelName?.trim();
    if ((legacyApiKey || legacyModelName) && !normalized[resolvedInitialProvider]) {
      normalized[resolvedInitialProvider] = {
        apiKey: legacyApiKey || undefined,
        modelName: legacyModelName || undefined,
      };
    }

    return normalized;
  };

  const initialProviderSettings = createInitialProviderSettings();
  const initialSelectedProviderConfig = initialProviderSettings[resolvedInitialProvider];

  const [providerName, setProviderName] = useState(resolvedInitialProvider);
  const [providerSettings, setProviderSettings] = useState<ProviderSettingsMap>(initialProviderSettings);
  const [modelName, setModelName] = useState(initialSelectedProviderConfig?.modelName ?? "");
  const [apiKey, setApiKey] = useState(initialSelectedProviderConfig?.apiKey ?? "");
  const [saved, setSaved] = useState(false);

  const providerLabelByName: Record<string, string> = {
    groq: "Groq",
    openrouter: "OpenRouter",
    google: "Google",
  };
  const providerLabel = providerLabelByName[providerName] ?? providerName;

  const modelPlaceholderByProvider: Record<string, string> = {
    groq: "llama-3.1-8b-instant",
    openrouter: "openrouter/free",
    google: "gemini-3.1-flash-lite-preview",
  };
  const modelPlaceholder = modelPlaceholderByProvider[providerName] ?? "model-name";

  const keyPlaceholderByProvider: Record<string, string> = {
    groq: "gsk_...",
    openrouter: "sk-or-v1-...",
    google: "AIza...",
  };
  const keyPlaceholder = keyPlaceholderByProvider[providerName] ?? "api-key";

  const saveSettings = () => {
    const normalizedProviderSettings = Object.entries(providerSettings).reduce<ProviderSettingsMap>((acc, [provider, config]) => {
      const normalizedProvider = provider.trim().toLowerCase();
      if (!normalizedProvider) {
        return acc;
      }

      const normalizedApiKey = config?.apiKey?.trim();
      const normalizedModelName = config?.modelName?.trim();
      if (!normalizedApiKey && !normalizedModelName) {
        return acc;
      }

      acc[normalizedProvider] = {
        apiKey: normalizedApiKey || undefined,
        modelName: normalizedModelName || undefined,
      };

      return acc;
    }, {});

    const activeApiKey = apiKey.trim() || undefined;
    const activeModelName = modelName.trim() || undefined;
    if (activeApiKey || activeModelName) {
      normalizedProviderSettings[providerName] = {
        apiKey: activeApiKey,
        modelName: activeModelName,
      };
    } else {
      delete normalizedProviderSettings[providerName];
    }

    onSave({
      providerName,
      modelName: activeModelName,
      apiKey: activeApiKey,
      providerSettings: normalizedProviderSettings,
    });
    setSaved(true);
  };

  return (
    <section className="st-panel st-enter flex flex-col gap-2 p-3">
      {showHeader ? <h2 className="st-title">BYOK Settings</h2> : null}
      {showHeader ? <p className="st-subtitle">Configure provider credentials used by your local browser session.</p> : null}
      <div className="st-form-grid" role="group" aria-label="BYOK settings form">
        <label className="st-label" htmlFor="provider-name-input">Provider</label>
        <select
          className="st-select"
          id="provider-name-input"
          name="stack-tutor-provider"
          autoComplete="off"
          value={providerName}
          onChange={(event) => {
            const nextProvider = event.target.value;
            const nextConfig = providerSettings[nextProvider];
            setProviderName(nextProvider);
            setModelName(nextConfig?.modelName ?? "");
            setApiKey(nextConfig?.apiKey ?? "");
            setSaved(false);
          }}
        >
          {normalizedProviderOptions.map((provider) => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>

        <label className="st-label" htmlFor="model-name-input">Default model (optional)</label>
        <input
          className="st-input"
          id="model-name-input"
          name="stack-tutor-model"
          autoComplete="off"
          spellCheck={false}
          value={modelName}
          onChange={(event) => {
            const nextValue = event.target.value;
            setModelName(nextValue);
            setProviderSettings((current) => {
              const currentProvider = current[providerName] ?? {};
              return {
                ...current,
                [providerName]: {
                  ...currentProvider,
                  modelName: nextValue || undefined,
                },
              };
            });
            setSaved(false);
          }}
          placeholder={modelPlaceholder}
        />

        <label className="st-label" htmlFor="api-key-input">{providerLabel} API key</label>
        <input
          className="st-input"
          id="api-key-input"
          name="stack-tutor-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          value={apiKey}
          onChange={(event) => {
            const nextValue = event.target.value;
            setApiKey(nextValue);
            setProviderSettings((current) => {
              const currentProvider = current[providerName] ?? {};
              return {
                ...current,
                [providerName]: {
                  ...currentProvider,
                  apiKey: nextValue || undefined,
                },
              };
            });
            setSaved(false);
          }}
          placeholder={keyPlaceholder}
        />

        <button
          className="st-button st-button--primary text-center"
          type="button"
          onClick={saveSettings}
        >
          Save
        </button>
      </div>
      {saved ? <p className="st-subtitle">Saved to local settings.</p> : null}
    </section>
  );
}
