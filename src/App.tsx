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
  const [feedError, setFeedError] = useState<string | null>(null);

  const refreshSessions = () => {
    setSessions(appStore.getSessionList());
  };

  const selectSession = (sessionId: string) => {
    try {
      const snapshot = appStore.switchActiveSession(sessionId);
      setActiveSessionId(sessionId);
      setActiveSession(snapshot);
      setIsStartView(false);
      setFeedError(null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Unable to switch session");
    }
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
      setFeedError(null);
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

  const runLessonCycle = async (sessionId: string): Promise<TutorSessionSnapshot> => {
    const expansion = await appStore.expandTopIfNeeded(sessionId);
    let snapshot = expansion.snapshot;

    if (expansion.pending) {
      if (expansion.pending.suggested.length > 0) {
        setFeedError("Prerequisite review is pending. Review UI is next increment.");
        return snapshot;
      }

      snapshot = appStore.dismissPendingPrerequisites(sessionId, expansion.pending.parentTopicId);
    }

    const lesson = await appStore.teachCurrentStep(sessionId, "initial");
    return lesson.snapshot;
  };

  const withActiveSession = async (
    operation: (sessionId: string) => Promise<TutorSessionSnapshot> | TutorSessionSnapshot,
  ) => {
    const sessionId = activeSessionId;
    if (!sessionId) {
      setFeedError("No active session selected.");
      return;
    }

    try {
      setFeedError(null);
      const snapshot = await operation(sessionId);
      setActiveSession(snapshot);
      refreshSessions();
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Operation failed");
    }
  };

  const onStartLesson = () => {
    void withActiveSession(async (sessionId) => runLessonCycle(sessionId));
  };

  const onProceed = (_stepId?: string) => {
    void withActiveSession(async (sessionId) => {
      const result = appStore.proceedCurrentStep(sessionId);
      if (result.sessionCompleted) {
        return result.snapshot;
      }

      return runLessonCycle(sessionId);
    });
  };

  const onRetry = (_stepId?: string) => {
    void withActiveSession(async (sessionId) => {
      const result = await appStore.retryCurrentStep(sessionId);
      return result.snapshot;
    });
  };

  const onDoubt = (_stepId: string | undefined, question: string) => {
    void withActiveSession(async (sessionId) => {
      const result = await appStore.askStepDoubt(sessionId, question);
      return result.snapshot;
    });
  };

  const onRemoveStackItem = (itemId: string) => {
    void withActiveSession((sessionId) => appStore.removeStackItem(sessionId, itemId));
  };

  const onMoveStackItem = (fromIndex: number, toIndex: number) => {
    void withActiveSession((sessionId) => appStore.moveStackItem(sessionId, fromIndex, toIndex));
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
          error={feedError}
          onStartLesson={onStartLesson}
          onProceed={onProceed}
          onRetry={onRetry}
          onDoubt={onDoubt}
        />
      )}

      <RightSidebar
        stack={activeSession?.stack ?? []}
        onRemoveItem={onRemoveStackItem}
        onMoveItem={onMoveStackItem}
      />
    </div>
  );
}

export default App;
