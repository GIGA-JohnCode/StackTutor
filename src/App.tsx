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
  const providerOptions = useMemo(() => appStore.getAvailableProviders(), [appStore]);
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
  const [pendingSelectionByReview, setPendingSelectionByReview] = useState<Record<string, boolean[]>>({});

  const pendingReview = activeSession?.pendingPrerequisiteReview ?? null;
  const pendingReviewKey = pendingReview ? `${pendingReview.parentTopicId}:${pendingReview.createdAt}` : null;
  const pendingSelection = useMemo(() => {
    if (!pendingReview || !pendingReviewKey) {
      return [];
    }

    return pendingSelectionByReview[pendingReviewKey] ?? pendingReview.suggested.map(() => true);
  }, [pendingReview, pendingReviewKey, pendingSelectionByReview]);
  const layoutClassName = isStartView
    ? "grid h-screen grid-cols-1 gap-3 overflow-hidden bg-slate-50 p-3 text-slate-900 lg:grid-cols-[280px_minmax(0,1fr)]"
    : "grid h-screen grid-cols-1 gap-3 overflow-hidden bg-slate-50 p-3 text-slate-900 lg:grid-cols-[280px_minmax(0,1fr)_320px]";

  const refreshSessions = () => {
    setSessions(appStore.getSessionList());
  };

  const selectSession = (sessionId: string) => {
    try {
      const snapshot = appStore.switchActiveSession(sessionId);
      setActiveSessionId(sessionId);
      setActiveSession(snapshot);
      setIsStartView(false);
      setStartError(null);
      setFeedError(null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Unable to switch session");
    }
  };

  const onOpenNewSession = () => {
    setIsStartView(true);
    setFeedError(null);
  };

  const startSession = (
    topic: string,
    maxDepth: number,
    rootProficiency: TopicItem["proficiency"],
    rootContext?: string,
  ) => {
    try {
      const engine = appStore.createEngineForNewSession(topic, maxDepth, rootProficiency, rootContext);
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

  const onProceed = () => {
    void withActiveSession(async (sessionId) => {
      const result = appStore.proceedCurrentStep(sessionId);
      if (result.sessionCompleted) {
        return result.snapshot;
      }

      return runLessonCycle(sessionId);
    });
  };

  const onRetry = () => {
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

  const onRemoveUpcomingStep = (topicId: string, stepId: string) => {
    void withActiveSession((sessionId) => appStore.removeUpcomingStep(sessionId, topicId, stepId));
  };

  const onTogglePendingSelection = (index: number) => {
    if (!pendingReview || !pendingReviewKey) {
      return;
    }

    setPendingSelectionByReview((current) => {
      const baseline = current[pendingReviewKey] ?? pendingReview.suggested.map(() => true);
      return {
        ...current,
        [pendingReviewKey]: baseline.map((value, idx) => (idx === index ? !value : value)),
      };
    });
  };

  const onAcceptPendingSuggestions = () => {
    if (!pendingReview) {
      return;
    }

    const accepted = pendingReview.suggested.filter((_, index) => pendingSelection[index]);
    void withActiveSession(async (sessionId) => {
      appStore.acceptPendingPrerequisites(sessionId, pendingReview.parentTopicId, accepted);
      return runLessonCycle(sessionId);
    });
  };

  const onDismissPendingSuggestions = () => {
    if (!pendingReview) {
      return;
    }

    void withActiveSession(async (sessionId) => {
      appStore.dismissPendingPrerequisites(sessionId, pendingReview.parentTopicId);
      return runLessonCycle(sessionId);
    });
  };

  const onDeleteSession = (sessionId: string) => {
    try {
      const deletedActive = activeSessionId === sessionId;
      appStore.removeSession(sessionId);
      refreshSessions();

      const nextActiveId = appStore.getActiveSessionId();
      const nextSnapshot = nextActiveId ? appStore.getSessionSnapshotById(nextActiveId) : null;
      setActiveSessionId(nextActiveId);
      setActiveSession(nextSnapshot);

      if (deletedActive) {
        setIsStartView(!nextActiveId);
      }

      setStartError(null);
      setFeedError(null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Unable to delete session");
    }
  };

  return (
    <div className={layoutClassName}>
      <LeftSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onDeleteSession={onDeleteSession}
        onNewSession={onOpenNewSession}
      />

      {isStartView ? (
        <main className="flex h-full min-h-0 flex-col gap-3 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
          <ByokSettingsPanel
            initialSettings={settings}
            providerOptions={providerOptions}
            onSave={saveByokSettings}
          />
          <StartSessionView onStartSession={startSession} />
          {!appStore.isByokConfigured() ? (
            <p className="text-sm text-slate-500">Set your provider API key above before starting a session.</p>
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

      {!isStartView ? (
        <RightSidebar
          stack={activeSession?.stack ?? []}
          onRemoveItem={onRemoveStackItem}
          onMoveItem={onMoveStackItem}
          onRemoveUpcomingStep={onRemoveUpcomingStep}
        />
      ) : null}

      {!isStartView && pendingReview && pendingReview.suggested.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold">Review Prerequisites</h3>
            <p className="mt-1 text-sm text-slate-600">
              Select prerequisites to add for {pendingReview.parentTopic.name}.
            </p>
            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
              {pendingReview.suggested.map((item, index) => (
                <label
                  key={`${pendingReview.parentTopicId}:${item.name}:${index}`}
                  className="flex cursor-pointer items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pendingSelection[index] ?? false}
                      onChange={() => onTogglePendingSelection(index)}
                    />
                    <span>{item.name}</span>
                  </div>
                  <small className="text-xs uppercase text-slate-500">{item.proficiency}</small>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900"
                type="button"
                onClick={onAcceptPendingSuggestions}
              >
                Apply Selected
              </button>
              <button
                className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900"
                type="button"
                onClick={onDismissPendingSuggestions}
              >
                Dismiss All
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
