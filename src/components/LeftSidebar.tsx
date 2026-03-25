import type { SessionListItem } from "../core/types/domain";

// Shows session list, completion status, and controls for switching or creating sessions.
interface LeftSidebarProps {
  sessions: SessionListItem[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export function LeftSidebar(props: LeftSidebarProps) {
  const { sessions, activeSessionId, onSelectSession, onNewSession } = props;

  return (
    <aside className="flex min-h-0 flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
      <button
        className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left text-slate-900"
        type="button"
        onClick={onNewSession}
      >
        New Session
      </button>
      <h2 className="text-lg font-semibold">Sessions</h2>
      <div className="flex flex-col gap-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No sessions yet.</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              className={
                session.id === activeSessionId
                  ? "flex cursor-pointer items-center justify-between rounded-lg border border-blue-400 bg-blue-100 px-3 py-2 text-left text-slate-900"
                  : "flex cursor-pointer items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left text-slate-900"
              }
              type="button"
              onClick={() => onSelectSession(session.id)}
            >
              <span>{session.title}</span>
              <small className="text-xs text-slate-600">{session.status}</small>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}