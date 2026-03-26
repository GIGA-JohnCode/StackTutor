import { useMemo, useState } from "react";
import { LeftSidebar } from "./components/LeftSidebar";
import { MainFeed } from "./components/MainFeed";
import { RightSidebar } from "./components/RightSidebar";
import { StartSessionView } from "./components/StartSessionView";
import { ByokSettingsPanel } from "./components/ByokSettingsPanel";
import type { AppSettings } from "./core/persistence/SettingsRepository";
import type { SessionListItem, TopicItem, TutorSessionSnapshot } from "./core/types/domain";
import { TutorAppStore } from "./store/TutorAppStore";

function App() {
  const appStore = useMemo(() => new TutorAppStore(), []);
  const [isStartView, setIsStartView] = useState(true);
  const [sessions, setSessions] = useState<SessionListItem[]>(() => appStore.getSessionList());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => appStore.getActiveSessionId());
  const [activeSession, setActiveSession] = useState<TutorSessionSnapshot | null>(() => {
    const activeId = appStore.getActiveSessionId();
    return activeId ? appStore.getSessionSnapshotById(activeId) : null;
  });
  const [settings, setSettings] = useState<AppSettings>(() => appStore.getSettings());
  const [startError, setStartError] = useState<string | null>(null);

  const refreshSessions = () => {
    setSessions(appStore.getSessionList());
  };

  const selectSession = (sessionId: string) => {
    appStore.setActiveSessionId(sessionId);
    setActiveSessionId(sessionId);
    setActiveSession(appStore.getSessionSnapshotById(sessionId));
    setIsStartView(false);
  };

  const startSession = (
    topic: string,
    maxDepth: number,
    rootProficiency: TopicItem["proficiency"],
  ) => {
    try {
      const engine = appStore.createEngineForNewSession(topic, maxDepth, rootProficiency);
      const snapshot = engine.getSessionSnapshot();
      setActiveSessionId(snapshot.id);
      setActiveSession(snapshot);
      setIsStartView(false);
      setStartError(null);
      refreshSessions();
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Unable to start session");
    }
  };

  const saveByokSettings = (nextSettings: AppSettings) => {
    appStore.saveSettings(nextSettings);
    setSettings(nextSettings);
    if (nextSettings.apiKey?.trim()) {
      setStartError(null);
    }
  };

  const onProceedPlaceholder = (stepId?: string) => {
    void stepId;
    setStartError("Proceed flow is scaffolded but not implemented yet.");
  };

  const onRetryPlaceholder = (stepId?: string) => {
    void stepId;
    setStartError("Retry flow is scaffolded but not implemented yet.");
  };

  const onDoubtPlaceholder = (stepId: string | undefined, question: string) => {
    void stepId;
    void question;
    setStartError("Doubt flow is scaffolded but not implemented yet.");
  };

  const onRemoveStackItemPlaceholder = (itemId: string) => {
    void itemId;
    setStartError("Stack remove is scaffolded but not implemented yet.");
  };

  const onMoveStackItemPlaceholder = (fromIndex: number, toIndex: number) => {
    void fromIndex;
    void toIndex;
    setStartError("Stack reorder is scaffolded but not implemented yet.");
  };

  return (
    <div className="grid min-h-screen grid-cols-1 gap-3 bg-slate-50 p-3 text-slate-900 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <LeftSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onNewSession={() => setIsStartView(true)}
      />

      {isStartView ? (
        <main className="flex min-h-0 flex-col gap-3 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
          <ByokSettingsPanel initialSettings={settings} onSave={saveByokSettings} />
          <StartSessionView onStartSession={startSession} />
          {!appStore.isByokConfigured() ? (
            <p className="text-sm text-slate-500">Set your Groq API key above before starting a session.</p>
          ) : null}
          {startError ? <p className="text-sm text-red-700">{startError}</p> : null}
        </main>
      ) : (
        <MainFeed
          session={activeSession}
          onProceed={onProceedPlaceholder}
          onRetry={onRetryPlaceholder}
          onDoubt={onDoubtPlaceholder}
        />
      )}

      <RightSidebar
        stack={activeSession?.stack ?? []}
        onRemoveItem={onRemoveStackItemPlaceholder}
        onMoveItem={onMoveStackItemPlaceholder}
      />
    </div>
  );
}

export default App;
