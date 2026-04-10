import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { TutorSessionSnapshot } from "../core/types/domain";

const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];
const STREAMING_SHELL_ID = "__streaming_shell__";
const STREAMING_STATUS_KEYWORDS = [
  "preparing lesson",
  "completing current step",
  "preparing next lesson",
  "fetching prerequisites",
  "fetching steps",
  "generating lesson",
  "regenerating current lesson",
  "sending your doubt",
  "generating clarification",
  "generating next lesson",
  "applying prerequisite choices",
  "skipping prerequisite suggestions",
] as const;

export interface MainFeedStreamingReply {
  kind: "lesson" | "doubt" | "retry";
  topic: string;
  stepId?: string;
  content: string;
}

// Displays teaching output for the current topic and step controls.
// This area should show instruction -> response pairs in chronological order.
interface MainFeedProps {
  session: TutorSessionSnapshot | null;
  error?: string | null;
  isBusy?: boolean;
  statusMessage?: string | null;
  streamingReply?: MainFeedStreamingReply | null;
  onStartLesson?: () => void;
  onProceed?: (stepId?: string) => void;
  onRetry?: (stepId?: string) => void;
  onDoubt?: (stepId: string | undefined, question: string) => void;
}

interface MarkdownBodyProps {
  messageId: string;
  content: string;
  isStreaming?: boolean;
  copiedCodeId: string | null;
  onCopyCode: (code: string, codeId: string) => Promise<void>;
}

function flattenReactText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenReactText(item)).join("");
  }

  if (value && typeof value === "object" && "props" in value) {
    const element = value as { props?: { children?: ReactNode } };
    return flattenReactText(element.props?.children ?? "");
  }

  return "";
}

function normalizeMarkdownForRender(content: string, isStreaming: boolean): string {
  const normalized = content
    .replace(/\r\n?/g, "\n")
    .replace(/\u200b/g, "");

  if (!isStreaming) {
    return normalized;
  }

  const tripleFenceCount = (normalized.match(/```/g) ?? []).length;
  if (tripleFenceCount % 2 === 1) {
    return `${normalized}\n\`\`\``;
  }

  return normalized;
}

function MarkdownBody(props: MarkdownBodyProps) {
  const {
    messageId,
    content,
    isStreaming = false,
    copiedCodeId,
    onCopyCode,
  } = props;

  return (
    <div className="st-markdown">
      <ReactMarkdown
        remarkPlugins={MARKDOWN_PLUGINS}
        components={{
          pre({ children }) {
            const codeText = flattenReactText(children).replace(/\n$/, "");
            const codeId = `${messageId}:${codeText.slice(0, 48)}`;

            return (
              <div className="st-code-shell">
                <button
                  className="st-code-copy"
                  type="button"
                  onClick={() => void onCopyCode(codeText, codeId)}
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
        {normalizeMarkdownForRender(content, isStreaming)}
      </ReactMarkdown>
    </div>
  );
}

export function MainFeed(props: MainFeedProps) {
  const {
    session,
    error,
    isBusy = false,
    statusMessage,
    streamingReply,
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
  const pendingSpacerHeightRef = useRef(0);

  const feedLength = session?.feed.length ?? 0;
  const normalizedStatus = statusMessage?.toLowerCase() ?? "";
  const isTutorReplyPending = isBusy
    && STREAMING_STATUS_KEYWORDS.some((keyword) => normalizedStatus.includes(keyword));

  const latestPersistedActionableMessage = session
    ? [...session.feed].reverse().find((item) => item.role !== "user") ?? null
    : null;
  const persistedShellMessage = streamingReply ? null : latestPersistedActionableMessage;

  const historicalMessages = session
    ? session.feed.filter((item) => item.id !== persistedShellMessage?.id)
    : [];

  const hasLiveShell = Boolean(streamingReply) || Boolean(persistedShellMessage) || isTutorReplyPending;
  const shouldShowEmptyState = feedLength === 0 && !hasLiveShell;

  const shellId = streamingReply ? STREAMING_SHELL_ID : persistedShellMessage?.id ?? null;
  const shellKind = streamingReply?.kind ?? persistedShellMessage?.kind ?? "lesson";
  const shellTopic = streamingReply?.topic ?? persistedShellMessage?.topic ?? "Lesson";
  const shellStepId = streamingReply?.stepId ?? persistedShellMessage?.stepId;
  const shellContent = streamingReply?.content ?? persistedShellMessage?.content ?? "";
  const isStreamingShell = Boolean(streamingReply);
  const canShowShellActions = Boolean(persistedShellMessage && !isStreamingShell && persistedShellMessage.role !== "user");

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
    const container = feedContainerRef.current;
    const shell = pendingAnswerRef.current;

    if (!container) {
      return;
    }

    if (hasLiveShell && shell) {
      const containerRect = container.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const shellTop = container.scrollTop + (shellRect.top - containerRect.top);

      container.scrollTop = Math.max(0, Math.round(shellTop));
      return;
    }

    if (feedLength > 0) {
      container.scrollTop = container.scrollHeight;
    }
  }, [error, feedLength, hasLiveShell, shellContent]);

  useLayoutEffect(() => {
    const container = feedContainerRef.current;
    const shell = pendingAnswerRef.current;

    if (!container || !shell || !hasLiveShell) {
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

    container.scrollTop = Math.max(0, Math.round(shellTop));

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
  }, [hasLiveShell, shellContent, statusMessage]);

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

                  <MarkdownBody
                    messageId={message.id}
                    content={message.content}
                    copiedCodeId={copiedCodeId}
                    onCopyCode={copyCode}
                  />
                </article>
              ))
            )}

            {hasLiveShell ? (
              <article
                ref={pendingAnswerRef}
                className="st-feed-card st-feed-card--tutor st-feed-card--current"
                aria-live="polite"
                aria-label={isTutorReplyPending ? "Generating tutor response" : "Latest tutor response"}
              >
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <strong className="uppercase tracking-wide text-sm">{shellKind}</strong>
                    <span className="st-role-chip st-role-chip--tutor">Stack Tutor</span>
                  </div>
                  <small className="st-status-chip st-topic-chip">
                    {isTutorReplyPending ? "Generating" : shellTopic}
                  </small>
                </header>

                {shellContent ? (
                  <MarkdownBody
                    messageId={shellId ?? STREAMING_SHELL_ID}
                    content={shellContent}
                    isStreaming={isStreamingShell}
                    copiedCodeId={copiedCodeId}
                    onCopyCode={copyCode}
                  />
                ) : isTutorReplyPending ? (
                  <div className="min-h-16" />
                ) : null}

                {canShowShellActions && shellId ? (
                  <div className="st-inline-actions">
                    <button
                      className="st-button st-button--ghost"
                      type="button"
                      onClick={() => onProceed?.(shellStepId)}
                      disabled={isBusy}
                    >
                      Proceed
                    </button>
                    <button
                      className="st-button st-button--ghost"
                      type="button"
                      onClick={() => onRetry?.(shellStepId)}
                      disabled={isBusy}
                    >
                      Retry
                    </button>
                    <button
                      className="st-button st-button--ghost"
                      type="button"
                      onClick={() => {
                        setDoubtTargetMessageId((current) => (current === shellId ? null : shellId));
                        setDoubtText("");
                      }}
                      disabled={isBusy}
                    >
                      Doubt
                    </button>
                  </div>
                ) : null}

                {canShowShellActions && shellId && doubtTargetMessageId === shellId ? (
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

                          onDoubt?.(shellStepId, normalized);
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
            ) : null}

            {hasLiveShell ? (
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
