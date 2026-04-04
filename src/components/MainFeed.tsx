import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { TutorSessionSnapshot } from "../core/types/domain";

// Displays teaching output for the current topic and step controls.
// This area should show instruction -> response pairs in chronological order.
interface MainFeedProps {
  session: TutorSessionSnapshot | null;
  error?: string | null;
  onStartLesson?: () => void;
  onProceed?: (stepId?: string) => void;
  onRetry?: (stepId?: string) => void;
  onDoubt?: (stepId: string | undefined, question: string) => void;
}

export function MainFeed(props: MainFeedProps) {
  const { session, error, onStartLesson, onProceed, onRetry, onDoubt } = props;
  const [doubtTargetMessageId, setDoubtTargetMessageId] = useState<string | null>(null);
  const [doubtText, setDoubtText] = useState("");
  const feedContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!session || session.feed.length === 0 || !feedContainerRef.current) {
      return;
    }

    feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
  }, [session?.feed.length, error]);

  return (
    <main ref={feedContainerRef} className="h-full min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="text-lg font-semibold">Tutor Feed</h2>
      {!session ? (
        <p className="text-sm text-slate-500">Select a session or create a new one.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {session.feed.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-500">No tutor messages yet.</p>
              <button
                className="w-fit cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900"
                type="button"
                onClick={() => onStartLesson?.()}
              >
                Start Lesson
              </button>
            </div>
          ) : (
            session.feed.map((message) => (
              <article key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <header className="flex items-center justify-between gap-2">
                  <strong>{message.kind}</strong>
                  <small className="text-xs text-slate-600">{message.topic}</small>
                </header>
                <div className="mt-1 text-sm leading-6 text-slate-900 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-200 [&_pre]:p-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
                    type="button"
                    onClick={() => onProceed?.(message.stepId)}
                  >
                    Proceed
                  </button>
                  <button
                    className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
                    type="button"
                    onClick={() => onRetry?.(message.stepId)}
                  >
                    Retry
                  </button>
                  <button
                    className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
                    type="button"
                    onClick={() => {
                      setDoubtTargetMessageId((current) => (current === message.id ? null : message.id));
                      setDoubtText("");
                    }}
                  >
                    Doubt
                  </button>
                </div>
                {doubtTargetMessageId === message.id ? (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <input
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Ask your doubt"
                      value={doubtText}
                      onChange={(event) => setDoubtText(event.target.value)}
                    />
                    <div className="flex gap-1.5">
                      <button
                        className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
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
                      >
                        Send
                      </button>
                      <button
                        className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
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
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}