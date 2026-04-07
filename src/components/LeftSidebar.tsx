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
    <aside className="st-panel st-sidebar st-enter">
      <button
        className="st-button st-button--primary text-left"
        type="button"
        onClick={onNewSession}
      >
        New Session
      </button>
      <h2 className="st-title">Sessions</h2>
      <div className="st-scroll">
        {sessions.length === 0 ? (
          <p className="st-subtitle">No sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <div key={session.id} className="st-session-item">
                <button
                  className={
                    session.id === activeSessionId
                      ? "st-button st-button--ghost st-session-select st-session-select--active"
                      : "st-button st-button--ghost st-session-select"
                  }
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                >
                  <span>{session.title}</span>
                  {session.status === "active" ? (
                    <span
                      className="st-status-light"
                      aria-label="Active session"
                      title="Active session"
                    />
                  ) : (
                    <small className="st-status-chip">{session.status}</small>
                  )}
                </button>
                <button
                  className="st-button st-button--danger text-xs"
                  type="button"
                  onClick={() => onDeleteSession?.(session.id)}
                  aria-label={`Delete session ${session.title}`}
                  title="Delete session"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}