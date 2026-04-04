import { useState } from "react";
import type { AppSettings } from "../core/persistence/SettingsRepository";

interface ByokSettingsPanelProps {
  initialSettings: AppSettings;
  providerOptions: string[];
  onSave: (settings: AppSettings) => void;
}

// Scaffold-only BYOK form. This persists user settings but does not validate keys against the API yet.
export function ByokSettingsPanel(props: ByokSettingsPanelProps) {
  const { initialSettings, providerOptions, onSave } = props;
  const normalizedProviderOptions = providerOptions.length > 0 ? providerOptions : ["groq"];
  const normalizedInitialProvider = initialSettings.providerName.trim().toLowerCase();
  const resolvedInitialProvider = normalizedProviderOptions.includes(normalizedInitialProvider)
    ? normalizedInitialProvider
    : normalizedProviderOptions[0];

  const [providerName, setProviderName] = useState(resolvedInitialProvider);
  const [modelName, setModelName] = useState(initialSettings.modelName ?? "");
  const [apiKey, setApiKey] = useState(initialSettings.apiKey ?? "");
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

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      providerName,
      modelName: modelName.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
    });
    setSaved(true);
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-sky-50 p-3">
      <h2 className="text-lg font-semibold">BYOK Settings</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2">
        <label className="text-sm text-slate-700" htmlFor="provider-name-input">Provider</label>
        <select
          className="rounded-lg border border-slate-300 px-2 py-2 text-slate-900"
          id="provider-name-input"
          value={providerName}
          onChange={(event) => {
            setProviderName(event.target.value);
            setModelName("");
            setSaved(false);
          }}
        >
          {normalizedProviderOptions.map((provider) => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>

        <label className="text-sm text-slate-700" htmlFor="model-name-input">Default model (optional)</label>
        <input
          className="rounded-lg border border-slate-300 px-2 py-2 text-slate-900"
          id="model-name-input"
          value={modelName}
          onChange={(event) => {
            setModelName(event.target.value);
            setSaved(false);
          }}
          placeholder={modelPlaceholder}
        />

        <label className="text-sm text-slate-700" htmlFor="api-key-input">{providerLabel} API key</label>
        <input
          className="rounded-lg border border-slate-300 px-2 py-2 text-slate-900"
          id="api-key-input"
          type="password"
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setSaved(false);
          }}
          placeholder={keyPlaceholder}
        />

        <button
          className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left text-slate-900"
          type="submit"
        >
          Save BYOK Settings
        </button>
      </form>
      {saved ? <p className="text-sm text-slate-500">Saved to local settings.</p> : null}
    </section>
  );
}
