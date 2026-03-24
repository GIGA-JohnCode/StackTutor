// Vite auto-imports every `*.provider.ts` file here so new providers register without manual barrel edits.
const providerModules = import.meta.glob("./*.provider.ts", { eager: true });

void providerModules;