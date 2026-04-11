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

interface StreamingReplyState {
  kind: "lesson" | "doubt" | "retry";
  topic: string;
  stepId?: string;
  content: string;
}

type ThemeMode = "dark" | "light";
const THEME_STORAGE_KEY = "stack-tutor-theme";

function resolveInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function App() {
  const appStore = useMemo(() => new TutorAppStore(), []);
  const providerOptions = useMemo(() => appStore.getAvailableProviders(), [appStore]);
  const [isStartView, setIsStartView] = useState(true);
  const [isByokOpen, setIsByokOpen] = useState(false);
  const [byokSavedMessage, setByokSavedMessage] = useState<string | null>(null);
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
  const [streamingReply, setStreamingReply] = useState<StreamingReplyState | null>(null);
  const [isLeftSidebarHidden, setIsLeftSidebarHidden] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => resolveInitialThemeMode());
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
    ? `st-shell st-shell--start${isLeftSidebarHidden ? " st-shell--start-no-left" : ""}`
    : `st-shell st-shell--session${isLeftSidebarHidden ? " st-shell--session-no-left" : ""}`;

  const toggleLeftSidebarVisibility = () => {
    setIsLeftSidebarHidden((current) => !current);
  };

  const toggleThemeMode = () => {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  };

  const clearStreamingReply = () => {
    setStreamingReply(null);
  };

  const resolveTeachingTarget = (snapshot: TutorSessionSnapshot | null): { topic: string; stepId: string } | null => {
    if (!snapshot) {
      return null;
    }

    const top = snapshot.stack[snapshot.stack.length - 1];
    if (!top) {
      return null;
    }

    const step = top.steps[top.activeStepIndex];
    if (!step) {
      return null;
    }

    return {
      topic: top.topic.name,
      stepId: step.id,
    };
  };

  const beginStreamingReply = (kind: StreamingReplyState["kind"], snapshot: TutorSessionSnapshot | null) => {
    const target = resolveTeachingTarget(snapshot);
    if (!target) {
      clearStreamingReply();
      return;
    }

    setStreamingReply({
      kind,
      topic: target.topic,
      stepId: target.stepId,
      content: "",
    });
  };

  const onStreamingToken = (content: string) => {
    setStreamingReply((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        content,
      };
    });
  };

  useEffect(() => {
    logger.info("App state snapshot", {
      sessions: sessions.length,
      hasActiveSession: Boolean(activeSessionId),
      startView: isStartView,
    });
  }, [activeSessionId, isStartView, sessions.length]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("st-theme-light", themeMode === "light");
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

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
      clearStreamingReply();
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
    clearStreamingReply();
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
      clearStreamingReply();
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
    setIsByokOpen(false);
    setByokSavedMessage("BYOK settings saved.");
    window.setTimeout(() => {
      setByokSavedMessage((current) => (current === "BYOK settings saved." ? null : current));
    }, 2200);
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
    beginStreamingReply("lesson", snapshot);
    const lesson = await appStore.teachCurrentStep(
      sessionId,
      "initial",
      undefined,
      (update) => onStreamingToken(update.content),
    );
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
      clearStreamingReply();
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
      clearStreamingReply();
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
      beginStreamingReply("retry", activeSession);
      const result = await appStore.retryCurrentStep(sessionId, (update) => onStreamingToken(update.content));
      return result.snapshot;
    });
  };

  const onDoubt = (_stepId: string | undefined, question: string) => {
    logger.info("Doubt requested", { sessionId: activeSessionId, questionLength: question.trim().length });
    void withActiveSession("Sending your doubt...", async (sessionId, onProgress) => {
      onProgress("Generating clarification...");
      beginStreamingReply("doubt", activeSession);
      const result = await appStore.askStepDoubt(sessionId, question, (update) => onStreamingToken(update.content));
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

    const sessionId = activeSessionId;
    if (!sessionId) {
      return;
    }

    const accepted = pendingReview.suggested.filter((_, index) => pendingSelection[index]);
    logger.info("Accepting pending prerequisites", {
      sessionId,
      parentTopicId: pendingReview.parentTopicId,
      acceptedCount: accepted.length,
      suggestedCount: pendingReview.suggested.length,
    });

    try {
      const snapshot = appStore.acceptPendingPrerequisites(sessionId, pendingReview.parentTopicId, accepted);
      setActiveSession(snapshot);
      refreshSessions();
      setPendingSelectionByReview((current) => {
        const next = { ...current };
        if (pendingReviewKey) {
          delete next[pendingReviewKey];
        }
        return next;
      });
    } catch (error) {
      logger.error("Failed to accept pending prerequisites", { sessionId, error });
      setFeedError(error instanceof Error ? error.message : "Unable to apply prerequisite choices");
      return;
    }

    void withActiveSession("Generating next lesson...", async (nextSessionId, onProgress) => runLessonCycle(nextSessionId, onProgress));
  };

  const onDismissPendingSuggestions = () => {
    if (!pendingReview) {
      return;
    }

    const sessionId = activeSessionId;
    if (!sessionId) {
      return;
    }

    logger.info("Dismissing pending prerequisites", {
      sessionId,
      parentTopicId: pendingReview.parentTopicId,
    });

    try {
      const snapshot = appStore.dismissPendingPrerequisites(sessionId, pendingReview.parentTopicId);
      setActiveSession(snapshot);
      refreshSessions();
      setPendingSelectionByReview((current) => {
        const next = { ...current };
        if (pendingReviewKey) {
          delete next[pendingReviewKey];
        }
        return next;
      });
    } catch (error) {
      logger.error("Failed to dismiss pending prerequisites", { sessionId, error });
      setFeedError(error instanceof Error ? error.message : "Unable to dismiss prerequisite suggestions");
      return;
    }

    void withActiveSession("Generating next lesson...", async (nextSessionId, onProgress) => runLessonCycle(nextSessionId, onProgress));
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
      {isLeftSidebarHidden ? (
        <div className="st-sidebar-rail st-enter">
          <button
            className="st-button st-button--ghost st-sidebar-rail-btn"
            type="button"
            onClick={toggleLeftSidebarVisibility}
            aria-label="Show sessions panel"
            title="Show sessions panel"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="st-sidebar-fill-icon"
            >
              <rect x="5" y="6" width="14" height="2" rx="1" />
              <rect x="5" y="11" width="14" height="2" rx="1" />
              <rect x="5" y="16" width="14" height="2" rx="1" />
            </svg>
          </button>
          <div className="st-sidebar-rail-footer">
            <button
              className="st-button st-button--ghost st-icon-btn st-sidebar-footer-btn"
              type="button"
              onClick={toggleThemeMode}
              aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={themeMode === "dark" ? "Light mode" : "Dark mode"}
            >
              {themeMode === "dark" ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="st-sidebar-footer-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2.5" x2="12" y2="5" />
                  <line x1="12" y1="19" x2="12" y2="21.5" />
                  <line x1="2.5" y1="12" x2="5" y2="12" />
                  <line x1="19" y1="12" x2="21.5" y2="12" />
                  <line x1="5.3" y1="5.3" x2="7" y2="7" />
                  <line x1="17" y1="17" x2="18.7" y2="18.7" />
                  <line x1="17" y1="7" x2="18.7" y2="5.3" />
                  <line x1="5.3" y1="18.7" x2="7" y2="17" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="st-sidebar-footer-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.8A8.8 8.8 0 1 1 11.2 3A7 7 0 0 0 21 12.8Z" />
                </svg>
              )}
            </button>
            <button
              className="st-button st-button--ghost st-icon-btn st-sidebar-footer-btn"
              type="button"
              onClick={() => setIsByokOpen(true)}
              aria-label="Open BYOK settings"
              title="BYOK settings"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="st-sidebar-fill-icon"
              >
                <path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Zm9 3.5a7.9 7.9 0 0 0-.08-1l2.03-1.58l-1.8-3.12l-2.48.86a8.1 8.1 0 0 0-1.74-1.01l-.38-2.59h-3.6l-.38 2.59a8.1 8.1 0 0 0-1.74 1.01l-2.48-.86l-1.8 3.12L3.08 11a8.8 8.8 0 0 0 0 2l-2.03 1.58l1.8 3.12l2.48-.86c.54.42 1.12.76 1.74 1.01l.38 2.59h3.6l.38-2.59c.62-.25 1.2-.59 1.74-1.01l2.48.86l1.8-3.12L20.92 13c.06-.33.08-.66.08-1Z" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {!isLeftSidebarHidden ? (
        <LeftSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={selectSession}
          onDeleteSession={onDeleteSession}
          onNewSession={onOpenNewSession}
          onToggleVisibility={toggleLeftSidebarVisibility}
          themeMode={themeMode}
          onToggleTheme={toggleThemeMode}
          onOpenByok={() => setIsByokOpen(true)}
        />
      ) : null}

      {isStartView ? (
        <main className="st-panel st-main-stage st-enter flex flex-col gap-3">
          <p className="st-subtitle">Use the left sidebar footer for theme and BYOK settings.</p>

          <StartSessionView onStartSession={startSession} />
          {!appStore.isByokConfigured() ? (
            <p className="st-subtitle">Set your provider API key via the BYOK gear icon in the left sidebar before starting a session.</p>
          ) : null}
          {startError ? <p className="st-error">{startError}</p> : null}
        </main>
      ) : (
        <div className="st-feed-slot st-panel">
          <MainFeed
            session={activeSession}
            error={feedError}
            isBusy={isBusy}
            statusMessage={operationStatus}
            streamingReply={streamingReply}
            onStartLesson={onStartLesson}
            onProceed={onProceed}
            onRetry={onRetry}
            onDoubt={onDoubt}
          />
        </div>
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
        <div className="st-modal-backdrop">
          <div className="st-modal">
            <h3 className="st-title">Review Prerequisites</h3>
            <p className="st-subtitle mt-1">
              Select prerequisites to add for {pendingReview.parentTopic.name}.
            </p>
            <div className="st-check-list">
              {pendingReview.suggested.map((item, index) => (
                <label
                  key={`${pendingReview.parentTopicId}:${item.name}:${index}`}
                  className="st-check-row"
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
              <p className="st-banner mt-2" aria-live="polite">
                {operationStatus}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                className="st-button st-button--primary"
                type="button"
                onClick={onAcceptPendingSuggestions}
                disabled={isBusy}
              >
                Apply Selected
              </button>
              <button
                className="st-button st-button--ghost"
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

      {isByokOpen ? (
        <div className="st-modal-backdrop" onClick={() => setIsByokOpen(false)}>
          <div className="st-modal st-byok-modal" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="st-title">BYOK Settings</h3>
              <button
                type="button"
                className="st-button st-button--danger"
                onClick={() => setIsByokOpen(false)}
                aria-label="Close BYOK settings"
              >
                ×
              </button>
            </div>
            <ByokSettingsPanel
              initialSettings={settings}
              providerOptions={providerOptions}
              onSave={saveByokSettings}
              showHeader={false}
            />
          </div>
        </div>
      ) : null}

      {byokSavedMessage ? (
        <div className="st-toast-wrap" aria-live="polite">
          <p className="st-success-banner">{byokSavedMessage}</p>
        </div>
      ) : null}
    </div>
  );
}

export default App;
