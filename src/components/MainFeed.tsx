import type { TutorSessionSnapshot } from "../core/types/domain";

// Displays teaching output for the current topic and step controls.
// This area should show instruction -> response pairs in chronological order.
interface MainFeedProps {
  session: TutorSessionSnapshot | null;
  onProceed?: (stepId?: string) => void;
  onRetry?: (stepId?: string) => void;
  onDoubt?: (stepId: string | undefined, question: string) => void;
}

export function MainFeed(props: MainFeedProps) {
  const { session, onProceed, onRetry, onDoubt } = props;

  return (
    <main className="min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="text-lg font-semibold">Tutor Feed</h2>
      {!session ? (
        <p className="text-sm text-slate-500">Select a session or create a new one.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {session.feed.length === 0 ? (
            <p className="text-sm text-slate-500">No tutor messages yet.</p>
          ) : (
            session.feed.map((message) => (
              <article key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <header className="flex items-center justify-between gap-2">
                  <strong>{message.kind}</strong>
                  <small className="text-xs text-slate-600">{message.topic}</small>
                </header>
                <p className="mt-1">{message.content}</p>
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
                      const doubt = window.prompt("Enter your doubt:");
                      if (doubt && doubt.trim()) {
                        onDoubt?.(message.stepId, doubt.trim());
                      }
                    }}
                  >
                    Doubt
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </main>
  );
}