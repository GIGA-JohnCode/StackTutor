import type { StackItem } from "../core/types/domain";

// Shows editable learning stack for the active session.
// Must support reorder and remove actions initiated by the user.
interface RightSidebarProps {
  stack: StackItem[];
  onRemoveItem?: (itemId: string) => void;
  onMoveItem?: (fromIndex: number, toIndex: number) => void;
}

export function RightSidebar(props: RightSidebarProps) {
  const { stack, onRemoveItem, onMoveItem } = props;

  const reversedStack = stack.slice().reverse();

  return (
    <aside className="flex min-h-0 flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="text-lg font-semibold">Stack</h2>
      <div className="flex flex-col gap-2">
        {stack.length === 0 ? (
          <p className="text-sm text-slate-500">No items in stack.</p>
        ) : (
          reversedStack.map((item, index) => {
              const sourceIndex = stack.length - 1 - index;
              const canMoveDown = sourceIndex > 0;
              const canMoveUp = sourceIndex < stack.length - 1;

              return (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <div>{item.topic.name}</div>
                    <small className="text-xs text-slate-600">Depth {item.depth}</small>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={() => onMoveItem?.(sourceIndex, sourceIndex - 1)}
                      disabled={!canMoveDown}
                    >
                      Down
                    </button>
                    <button
                      className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={() => onMoveItem?.(sourceIndex, sourceIndex + 1)}
                      disabled={!canMoveUp}
                    >
                      Up
                    </button>
                    <button
                      className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-900"
                      type="button"
                      onClick={() => onRemoveItem?.(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
              );
            })
        )}
      </div>
    </aside>
  );
}