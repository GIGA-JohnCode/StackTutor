import type { TutorSessionSnapshot } from "../core/types/domain";

// Displays teaching output for the current topic and step controls.
// This area should show instruction -> response pairs in chronological order.
interface MainFeedProps {
  session: TutorSessionSnapshot | null;
}

export function MainFeed(props: MainFeedProps) {
  const { session } = props;

  return (
    <main className="panel panel-main">
      <h2>Tutor Feed</h2>
      {!session ? (
        <p className="muted">Select a session or create a new one.</p>
      ) : (
        <div className="feed-list">
          {session.feed.length === 0 ? (
            <p className="muted">No tutor messages yet.</p>
          ) : (
            session.feed.map((message) => (
              <article key={message.id} className="feed-item">
                <header>
                  <strong>{message.kind}</strong>
                  <small>{message.topic}</small>
                </header>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>
      )}
    </main>
  );
}