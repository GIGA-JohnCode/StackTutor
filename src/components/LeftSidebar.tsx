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
    <aside className="panel panel-left">
      <button className="panel-action" type="button" onClick={onNewSession}>
        New Session
      </button>
      <h2>Sessions</h2>
      <div className="session-list">
        {sessions.length === 0 ? (
          <p className="muted">No sessions yet.</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              className={session.id === activeSessionId ? "session-item active" : "session-item"}
              type="button"
              onClick={() => onSelectSession(session.id)}
            >
              <span>{session.title}</span>
              <small>{session.status}</small>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}