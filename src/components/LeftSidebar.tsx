import type { SessionListItem } from "../core/types/domain";

// Shows session list, completion status, and controls for switching or creating sessions.
interface LeftSidebarProps {
  sessions: SessionListItem[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onNewSession: () => void;
  onToggleVisibility?: () => void;
  themeMode: "dark" | "light";
  onToggleTheme?: () => void;
  onOpenByok?: () => void;
}

export function LeftSidebar(props: LeftSidebarProps) {
  const {
    sessions,
    activeSessionId,
    onSelectSession,
    onDeleteSession,
    onNewSession,
    onToggleVisibility,
    themeMode,
    onToggleTheme,
    onOpenByok,
  } = props;

  return (
    <aside className="st-panel st-sidebar st-enter">
      <div className="st-sidebar-top-row">
        <h2 className="st-title">Sessions</h2>
        <button
          className="st-button st-button--ghost st-icon-btn st-sidebar-toggle-btn"
          type="button"
          onClick={() => onToggleVisibility?.()}
          aria-label="Hide sessions panel"
          title="Hide sessions panel"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="st-sidebar-toggle-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 6L9 12L14 18" />
          </svg>
        </button>
      </div>
      <button
        className="st-button st-button--primary text-left"
        type="button"
        onClick={onNewSession}
      >
        New Session
      </button>
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
      <div className="st-sidebar-footer">
        <button
          className="st-button st-button--ghost st-icon-btn st-sidebar-footer-btn"
          type="button"
          onClick={() => onToggleTheme?.()}
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
          onClick={() => onOpenByok?.()}
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
    </aside>
  );
}