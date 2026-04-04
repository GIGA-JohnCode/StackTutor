import type { SessionListItem } from "../core/types/domain";

// Shows session list, completion status, and controls for switching or creating sessions.
interface LeftSidebarProps {
  sessions: SessionListItem[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onNewSession: () => void;
}

export function LeftSidebar(props: LeftSidebarProps) {
  const { sessions, activeSessionId, onSelectSession, onDeleteSession, onNewSession } = props;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
      <button
        className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left text-slate-900"
        type="button"
        onClick={onNewSession}
      >
        New Session
      </button>
      <h2 className="text-lg font-semibold">Sessions</h2>
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-2">
                <button
                  className={
                    session.id === activeSessionId
                      ? "flex flex-1 cursor-pointer items-center justify-between rounded-lg border border-blue-400 bg-blue-100 px-3 py-2 text-left text-slate-900"
                      : "flex flex-1 cursor-pointer items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left text-slate-900"
                  }
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                >
                  <span>{session.title}</span>
                  <small className="text-xs text-slate-600">{session.status}</small>
                </button>
                <button
                  className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-2 text-xs text-slate-900"
                  type="button"
                  onClick={() => onDeleteSession?.(session.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}