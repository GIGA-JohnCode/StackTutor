import type { StackItem } from "../core/types/domain";

// Shows editable learning stack for the active session.
// Must support reorder and remove actions initiated by the user.
interface RightSidebarProps {
  stack: StackItem[];
}

export function RightSidebar(props: RightSidebarProps) {
  const { stack } = props;

  return (
    <aside className="panel panel-right">
      <h2>Stack</h2>
      <div className="stack-list">
        {stack.length === 0 ? (
          <p className="muted">No items in stack.</p>
        ) : (
          stack
            .slice()
            .reverse()
            .map((item) => (
              <div key={item.id} className="stack-item">
                <div>{item.topic.name}</div>
                <small>Depth {item.depth}</small>
              </div>
            ))
        )}
      </div>
    </aside>
  );
}