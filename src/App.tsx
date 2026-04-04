import { useEffect, useMemo, useRef, useState } from "react";
import { LeftSidebar } from "./components/LeftSidebar";
import { MainFeed } from "./components/MainFeed";
import { RightSidebar } from "./components/RightSidebar";
import { StartSessionView } from "./components/StartSessionView";
import { ByokSettingsPanel } from "./components/ByokSettingsPanel";
import { getLogger } from "./core/logging/Logger";
import type { AppSettings } from "./core/persistence/SettingsRepository";
import type { SessionListItem, TopicItem, TutorSessionSnapshot } from "./core/types/domain";
import { TutorAppStore } from "./store/TutorAppStore";

const logger = getLogger("App");

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
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [pendingSelectionByReview, setPendingSelectionByReview] = useState<Record<string, boolean[]>>({});
  const operationInFlightRef = useRef(false);

  const isBusy = operationStatus !== null;

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

  useEffect(() => {
    logger.info("App state snapshot", {
      sessions: sessions.length,
      hasActiveSession: Boolean(activeSessionId),
      startView: isStartView,
    });
  }, [activeSessionId, isStartView, sessions.length]);

  const refreshSessions = () => {
    setSessions(appStore.getSessionList());
  };

  const selectSession = (sessionId: string) => {
    logger.info("Selecting session", { sessionId });
    try {
      const snapshot = appStore.switchActiveSession(sessionId);
      setActiveSessionId(sessionId);
      setActiveSession(snapshot);
      setIsStartView(false);
      setStartError(null);
      setFeedError(null);
      logger.info("Session selected", { sessionId, stackSize: snapshot.stack.length });
    } catch (error) {
      logger.error("Failed to select session", { sessionId, error });
      setFeedError(error instanceof Error ? error.message : "Unable to switch session");
    }
  };

  const onOpenNewSession = () => {
    logger.info("Opening new session view");
    setIsStartView(true);
    setFeedError(null);
  };

  const startSession = (
    topic: string,
    maxDepth: number,
    rootProficiency: TopicItem["proficiency"],
    rootContext?: string,
  ) => {
    logger.info("Starting session", {
      topic,
      maxDepth,
      rootProficiency,
      hasRootContext: Boolean(rootContext?.trim()),
    });
    try {
      const engine = appStore.createEngineForNewSession(topic, maxDepth, rootProficiency, rootContext);
      const snapshot = engine.getSessionSnapshot();
      setActiveSessionId(snapshot.id);
      setActiveSession(snapshot);
      setIsStartView(false);
      setStartError(null);
      setFeedError(null);
      refreshSessions();
      logger.info("Session started", { sessionId: snapshot.id, title: snapshot.title });
    } catch (error) {
      logger.error("Failed to start session", { topic, error });
      setStartError(error instanceof Error ? error.message : "Unable to start session");
    }
  };

  const saveByokSettings = (nextSettings: AppSettings) => {
    logger.info("Saving BYOK settings", {
      providerName: nextSettings.providerName,
      hasApiKey: Boolean(nextSettings.apiKey?.trim()),
      hasModelName: Boolean(nextSettings.modelName?.trim()),
    });
    appStore.saveSettings(nextSettings);
    setSettings(nextSettings);
    if (nextSettings.apiKey?.trim()) {
      setStartError(null);
    }
  };

  const runLessonCycle = async (
    sessionId: string,
    onProgress?: (status: string) => void,
  ): Promise<TutorSessionSnapshot> => {
    logger.debug("Running lesson cycle", { sessionId });
    onProgress?.("Fetching prerequisites...");
    const expansion = await appStore.expandTopIfNeeded(sessionId);
    let snapshot = expansion.snapshot;

    if (expansion.pending) {
      if (expansion.pending.suggested.length > 0) {
        onProgress?.("Waiting for prerequisite selection...");
        return snapshot;
      }

      onProgress?.("No prerequisites found. Continuing...");
      snapshot = appStore.dismissPendingPrerequisites(sessionId, expansion.pending.parentTopicId);
    }

    onProgress?.("Fetching steps...");
    const decomposition = await appStore.decomposeTopIfNeeded(sessionId);
    snapshot = decomposition.snapshot;

    onProgress?.("Generating lesson...");
    const lesson = await appStore.teachCurrentStep(sessionId, "initial");
    onProgress?.("Finalizing update...");
    logger.debug("Lesson cycle completed", {
      sessionId,
      feedSize: lesson.snapshot.feed.length,
      stackSize: lesson.snapshot.stack.length,
    });
    return lesson.snapshot;
  };

  const withActiveSession = async (
    initialStatus: string,
    operation: (
      sessionId: string,
      onProgress: (status: string) => void,
    ) => Promise<TutorSessionSnapshot> | TutorSessionSnapshot,
  ) => {
    if (operationInFlightRef.current) {
      logger.warn("Operation ignored: another operation is in progress", { operationStatus });
      return;
    }

    const sessionId = activeSessionId;
    if (!sessionId) {
      logger.warn("Operation blocked: no active session selected");
      setFeedError("No active session selected.");
      return;
    }

    operationInFlightRef.current = true;

    try {
      setFeedError(null);
      setOperationStatus(initialStatus);
      const snapshot = await operation(sessionId, setOperationStatus);
      setActiveSession(snapshot);
      refreshSessions();
      logger.debug("Operation completed", { sessionId, stackSize: snapshot.stack.length, feedSize: snapshot.feed.length });
    } catch (error) {
      logger.error("Operation failed", { sessionId, error });
      setFeedError(error instanceof Error ? error.message : "Operation failed");
    } finally {
      operationInFlightRef.current = false;
      setOperationStatus(null);
    }
  };

  const onStartLesson = () => {
    logger.info("Start lesson requested", { sessionId: activeSessionId });
    void withActiveSession("Preparing lesson...", async (sessionId, onProgress) => runLessonCycle(sessionId, onProgress));
  };

  const onProceed = () => {
    logger.info("Proceed requested", { sessionId: activeSessionId });
    void withActiveSession("Completing current step...", async (sessionId, onProgress) => {
      const result = appStore.proceedCurrentStep(sessionId);
      if (result.sessionCompleted) {
        logger.info("Session completed after proceed", { sessionId });
        return result.snapshot;
      }

      onProgress("Preparing next lesson...");
      return runLessonCycle(sessionId, onProgress);
    });
  };

  const onRetry = () => {
    logger.info("Retry requested", { sessionId: activeSessionId });
    void withActiveSession("Regenerating current lesson...", async (sessionId, onProgress) => {
      onProgress("Generating lesson...");
      const result = await appStore.retryCurrentStep(sessionId);
      return result.snapshot;
    });
  };

  const onDoubt = (_stepId: string | undefined, question: string) => {
    logger.info("Doubt requested", { sessionId: activeSessionId, questionLength: question.trim().length });
    void withActiveSession("Sending your doubt...", async (sessionId, onProgress) => {
      onProgress("Generating clarification...");
      const result = await appStore.askStepDoubt(sessionId, question);
      return result.snapshot;
    });
  };

  const onRemoveStackItem = (itemId: string) => {
    logger.info("Removing stack item", { sessionId: activeSessionId, itemId });
    void withActiveSession("Updating stack...", (sessionId) => appStore.removeStackItem(sessionId, itemId));
  };

  const onMoveStackItem = (fromIndex: number, toIndex: number) => {
    logger.info("Moving stack item", { sessionId: activeSessionId, fromIndex, toIndex });
    void withActiveSession("Reordering stack...", (sessionId) => appStore.moveStackItem(sessionId, fromIndex, toIndex));
  };

  const onRemoveUpcomingStep = (topicId: string, stepId: string) => {
    logger.info("Removing upcoming step", { sessionId: activeSessionId, topicId, stepId });
    void withActiveSession("Removing step...", (sessionId) => appStore.removeUpcomingStep(sessionId, topicId, stepId));
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
    logger.info("Accepting pending prerequisites", {
      sessionId: activeSessionId,
      parentTopicId: pendingReview.parentTopicId,
      acceptedCount: accepted.length,
      suggestedCount: pendingReview.suggested.length,
    });
    void withActiveSession("Applying prerequisite choices...", async (sessionId, onProgress) => {
      appStore.acceptPendingPrerequisites(sessionId, pendingReview.parentTopicId, accepted);
      onProgress("Generating next lesson...");
      return runLessonCycle(sessionId, onProgress);
    });
  };

  const onDismissPendingSuggestions = () => {
    if (!pendingReview) {
      return;
    }

    logger.info("Dismissing pending prerequisites", {
      sessionId: activeSessionId,
      parentTopicId: pendingReview.parentTopicId,
    });
    void withActiveSession("Skipping prerequisite suggestions...", async (sessionId, onProgress) => {
      appStore.dismissPendingPrerequisites(sessionId, pendingReview.parentTopicId);
      onProgress("Generating next lesson...");
      return runLessonCycle(sessionId, onProgress);
    });
  };

  const onDeleteSession = (sessionId: string) => {
    logger.info("Deleting session", { sessionId, wasActive: activeSessionId === sessionId });
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
      logger.info("Session deleted", { sessionId, nextActiveId });
    } catch (error) {
      logger.error("Failed to delete session", { sessionId, error });
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
          isBusy={isBusy}
          statusMessage={operationStatus}
          onStartLesson={onStartLesson}
          onProceed={onProceed}
          onRetry={onRetry}
          onDoubt={onDoubt}
        />
      )}

      {!isStartView ? (
        <RightSidebar
          stack={activeSession?.stack ?? []}
          isBusy={isBusy}
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
            {isBusy && operationStatus ? (
              <p className="mt-2 text-sm text-sky-700" aria-live="polite">
                {operationStatus}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={onAcceptPendingSuggestions}
                disabled={isBusy}
              >
                Apply Selected
              </button>
              <button
                className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={onDismissPendingSuggestions}
                disabled={isBusy}
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
