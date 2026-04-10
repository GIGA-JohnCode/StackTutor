import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { TutorSessionSnapshot } from "../core/types/domain";

// Displays teaching output for the current topic and step controls.
// This area should show instruction -> response pairs in chronological order.
interface MainFeedProps {
  session: TutorSessionSnapshot | null;
  error?: string | null;
  isBusy?: boolean;
  statusMessage?: string | null;
  onStartLesson?: () => void;
  onProceed?: (stepId?: string) => void;
  onRetry?: (stepId?: string) => void;
  onDoubt?: (stepId: string | undefined, question: string) => void;
}

export function MainFeed(props: MainFeedProps) {
  const {
    session,
    error,
    isBusy = false,
    statusMessage,
    onStartLesson,
    onProceed,
    onRetry,
    onDoubt,
  } = props;
  const [doubtTargetMessageId, setDoubtTargetMessageId] = useState<string | null>(null);
  const [doubtText, setDoubtText] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingAnswerRef = useRef<HTMLElement | null>(null);
  const pendingTailSpacerRef = useRef<HTMLDivElement | null>(null);
  const wasPendingReplyRef = useRef(false);
  const pendingSpacerHeightRef = useRef(0);

  const feedLength = session?.feed.length ?? 0;
  const normalizedStatus = statusMessage?.toLowerCase() ?? "";
  const isTutorReplyPending = isBusy && (
    normalizedStatus.includes("preparing lesson")
    || normalizedStatus.includes("completing current step")
    || normalizedStatus.includes("preparing next lesson")
    || normalizedStatus.includes("fetching prerequisites")
    || normalizedStatus.includes("fetching steps")
    || normalizedStatus.includes("generating lesson")
    || normalizedStatus.includes("regenerating current lesson")
    || normalizedStatus.includes("sending your doubt")
    || normalizedStatus.includes("generating clarification")
    || normalizedStatus.includes("generating next lesson")
    || normalizedStatus.includes("applying prerequisite choices")
    || normalizedStatus.includes("skipping prerequisite suggestions")
  );
  const shouldShowEmptyState = feedLength === 0 && !isTutorReplyPending;
  const latestActionableMessageId = session
    ? [...session.feed].reverse().find((item) => item.role !== "user")?.id ?? null
    : null;
  const activeShellMessage = latestActionableMessageId && session
    ? session.feed.find((item) => item.id === latestActionableMessageId) ?? null
    : null;
  const historicalMessages = session
    ? session.feed.filter((item) => item.id !== latestActionableMessageId)
    : [];

  const copyCode = async (code: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(codeId);
      window.setTimeout(() => {
        setCopiedCodeId((current) => (current === codeId ? null : current));
      }, 1400);
    } catch {
      setCopiedCodeId(null);
    }
  };

  useEffect(() => {
    if (feedLength === 0 || !feedContainerRef.current) {
      return;
    }

    if (activeShellMessage && pendingAnswerRef.current) {
      const container = feedContainerRef.current;
      const shell = pendingAnswerRef.current;
      const containerRect = container.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const shellTop = container.scrollTop + (shellRect.top - containerRect.top);

      container.scrollTop = Math.max(0, Math.round(shellTop));
      return;
    }

    feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
  }, [activeShellMessage, feedLength, error]);

  useLayoutEffect(() => {
    const container = feedContainerRef.current;
    const shell = pendingAnswerRef.current;

    if (!container || !shell || !activeShellMessage) {
      wasPendingReplyRef.current = false;

      if (pendingSpacerHeightRef.current !== 0) {
        pendingSpacerHeightRef.current = 0;
        if (pendingTailSpacerRef.current) {
          pendingTailSpacerRef.current.style.height = "0px";
        }
      }

      return;
    }

    const containerRect = container.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const shellTop = container.scrollTop + (shellRect.top - containerRect.top);
    const shellHeight = shellRect.height;
    const nextScrollTop = Math.max(0, Math.round(shellTop));

    container.scrollTop = nextScrollTop;

    const scrollHeightWithoutSpacer = container.scrollHeight - pendingSpacerHeightRef.current;
    const existingContentBelowShell = Math.max(0, scrollHeightWithoutSpacer - (shellTop + shellHeight));
    const viewportSpaceBelowShell = Math.max(0, container.clientHeight - shellHeight);
    const nextSpacerHeight = Math.max(0, viewportSpaceBelowShell - existingContentBelowShell);

    if (nextSpacerHeight !== pendingSpacerHeightRef.current) {
      pendingSpacerHeightRef.current = nextSpacerHeight;
      if (pendingTailSpacerRef.current) {
        pendingTailSpacerRef.current.style.height = `${String(nextSpacerHeight)}px`;
      }
    }

    wasPendingReplyRef.current = true;
  }, [activeShellMessage, feedLength, isTutorReplyPending, statusMessage]);

  return (
    <main className="st-panel st-feed st-enter">
      <h2 className="st-title">Tutor Feed</h2>
      <div ref={feedContainerRef} className="st-feed-scroll">
        {!session ? (
          <p className="st-subtitle">Select a session or create a new one.</p>
        ) : (
          <div className="st-feed-list">
            {shouldShowEmptyState ? (
              <div className="flex flex-col gap-2">
                <p className="st-subtitle">No tutor messages yet.</p>
                <button
                  className="st-button st-button--primary w-fit"
                  type="button"
                  onClick={() => onStartLesson?.()}
                  disabled={isBusy}
                >
                  Start Lesson
                </button>
              </div>
            ) : (
              historicalMessages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "st-feed-card st-feed-card--user"
                      : message.role === "tutor"
                        ? "st-feed-card st-feed-card--tutor"
                        : "st-feed-card st-feed-card--system"
                  }
                >
                  <header className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="uppercase tracking-wide text-sm">{message.kind}</strong>
                      <span
                        className={
                          message.role === "user"
                            ? "st-role-chip st-role-chip--user"
                            : message.role === "tutor"
                              ? "st-role-chip st-role-chip--tutor"
                              : "st-role-chip st-role-chip--system"
                        }
                      >
                        {message.role === "user" ? "User" : message.role === "tutor" ? "Stack Tutor" : "System"}
                      </span>
                    </div>
                    <small className="st-status-chip st-topic-chip">{message.topic}</small>
                  </header>
                  <div className="st-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        pre({ children }) {
                          const codeBlock = Array.isArray(children) ? children[0] : children;
                          const codeElement = codeBlock as { props?: { children?: React.ReactNode } } | null;
                          const codeText = typeof codeElement?.props?.children === "string"
                            ? codeElement.props.children
                            : Array.isArray(codeElement?.props?.children)
                              ? codeElement?.props?.children.join("")
                              : "";
                          const codeId = `${message.id}:${codeText.slice(0, 32)}`;

                          return (
                            <div className="st-code-shell">
                              <button
                                className="st-code-copy"
                                type="button"
                                onClick={() => void copyCode(codeText, codeId)}
                                disabled={!codeText}
                                aria-label="Copy code block"
                                title="Copy code block"
                              >
                                {copiedCodeId === codeId ? "✓" : "⧉"}
                              </button>
                              <pre>{children}</pre>
                            </div>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {message.role !== "user" && message.id === latestActionableMessageId ? (
                    <div className="st-inline-actions">
                      <button
                        className="st-button st-button--ghost"
                        type="button"
                        onClick={() => onProceed?.(message.stepId)}
                        disabled={isBusy}
                      >
                        Proceed
                      </button>
                      <button
                        className="st-button st-button--ghost"
                        type="button"
                        onClick={() => onRetry?.(message.stepId)}
                        disabled={isBusy}
                      >
                        Retry
                      </button>
                      <button
                        className="st-button st-button--ghost"
                        type="button"
                        onClick={() => {
                          setDoubtTargetMessageId((current) => (current === message.id ? null : message.id));
                          setDoubtText("");
                        }}
                        disabled={isBusy}
                      >
                        Doubt
                      </button>
                    </div>
                  ) : null}
                  {doubtTargetMessageId === message.id && message.role !== "user" && message.id === latestActionableMessageId ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <input
                        className="st-input"
                        placeholder="Ask your doubt"
                        value={doubtText}
                        onChange={(event) => setDoubtText(event.target.value)}
                        disabled={isBusy}
                      />
                      <div className="flex gap-1.5">
                        <button
                          className="st-button st-button--primary"
                          type="button"
                          onClick={() => {
                            const normalized = doubtText.trim();
                            if (!normalized) {
                              return;
                            }
                            onDoubt?.(message.stepId, normalized);
                            setDoubtTargetMessageId(null);
                            setDoubtText("");
                          }}
                          disabled={isBusy || !doubtText.trim()}
                        >
                          Send
                        </button>
                        <button
                          className="st-button st-button--ghost"
                          type="button"
                          onClick={() => {
                            setDoubtTargetMessageId(null);
                            setDoubtText("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            )}
            {activeShellMessage || isTutorReplyPending ? (
              <article
                ref={pendingAnswerRef}
                className="st-feed-card st-feed-card--tutor st-feed-card--current"
                aria-live="polite"
                aria-label={isTutorReplyPending ? "Generating tutor response" : "Latest tutor response"}
              >
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <strong className="uppercase tracking-wide text-sm">
                      {activeShellMessage?.kind ?? "lesson"}
                    </strong>
                    <span className="st-role-chip st-role-chip--tutor">Stack Tutor</span>
                  </div>
                  <small className="st-status-chip st-topic-chip">
                    {isTutorReplyPending ? "Generating" : activeShellMessage?.topic ?? "Lesson"}
                  </small>
                </header>
                {isTutorReplyPending ? (
                  <div className="min-h-16" />
                ) : activeShellMessage ? (
                  <>
                    <div className="st-markdown">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          pre({ children }) {
                            const codeBlock = Array.isArray(children) ? children[0] : children;
                            const codeElement = codeBlock as { props?: { children?: React.ReactNode } } | null;
                            const codeText = typeof codeElement?.props?.children === "string"
                              ? codeElement.props.children
                              : Array.isArray(codeElement?.props?.children)
                                ? codeElement?.props?.children.join("")
                                : "";
                            const codeId = `${activeShellMessage.id}:${codeText.slice(0, 32)}`;

                            return (
                              <div className="st-code-shell">
                                <button
                                  className="st-code-copy"
                                  type="button"
                                  onClick={() => void copyCode(codeText, codeId)}
                                  disabled={!codeText}
                                  aria-label="Copy code block"
                                  title="Copy code block"
                                >
                                  {copiedCodeId === codeId ? "✓" : "⧉"}
                                </button>
                                <pre>{children}</pre>
                              </div>
                            );
                          },
                        }}
                      >
                        {activeShellMessage.content}
                      </ReactMarkdown>
                    </div>
                    {activeShellMessage.role !== "user" ? (
                      <div className="st-inline-actions">
                        <button
                          className="st-button st-button--ghost"
                          type="button"
                          onClick={() => onProceed?.(activeShellMessage.stepId)}
                          disabled={isBusy}
                        >
                          Proceed
                        </button>
                        <button
                          className="st-button st-button--ghost"
                          type="button"
                          onClick={() => onRetry?.(activeShellMessage.stepId)}
                          disabled={isBusy}
                        >
                          Retry
                        </button>
                        <button
                          className="st-button st-button--ghost"
                          type="button"
                          onClick={() => {
                            setDoubtTargetMessageId((current) => (current === activeShellMessage.id ? null : activeShellMessage.id));
                            setDoubtText("");
                          }}
                          disabled={isBusy}
                        >
                          Doubt
                        </button>
                      </div>
                    ) : null}
                    {doubtTargetMessageId === activeShellMessage.id && activeShellMessage.role !== "user" ? (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <input
                          className="st-input"
                          placeholder="Ask your doubt"
                          value={doubtText}
                          onChange={(event) => setDoubtText(event.target.value)}
                          disabled={isBusy}
                        />
                        <div className="flex gap-1.5">
                          <button
                            className="st-button st-button--primary"
                            type="button"
                            onClick={() => {
                              const normalized = doubtText.trim();
                              if (!normalized) {
                                return;
                              }
                              onDoubt?.(activeShellMessage.stepId, normalized);
                              setDoubtTargetMessageId(null);
                              setDoubtText("");
                            }}
                            disabled={isBusy || !doubtText.trim()}
                          >
                            Send
                          </button>
                          <button
                            className="st-button st-button--ghost"
                            type="button"
                            onClick={() => {
                              setDoubtTargetMessageId(null);
                              setDoubtText("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            ) : null}
            {isTutorReplyPending ? (
              <div ref={pendingTailSpacerRef} aria-hidden="true" style={{ height: "0px" }} />
            ) : null}
            {isBusy ? (
              <div className="st-banner" aria-live="polite">
                <span className="st-banner-dot" aria-hidden="true" />
                <span>{statusMessage ?? "Working..."}</span>
              </div>
            ) : null}
            {error ? (
              <div className="st-error">
                {error}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
