import { useEffect, useRef } from "react";
import type { StackItem } from "../core/types/domain";

// Shows editable learning stack for the active session.
// Must support reorder and remove actions initiated by the user.
interface RightSidebarProps {
  stack: StackItem[];
  onRemoveItem?: (itemId: string) => void;
  onMoveItem?: (fromIndex: number, toIndex: number) => void;
  onRemoveUpcomingStep?: (topicId: string, stepId: string) => void;
}

export function RightSidebar(props: RightSidebarProps) {
  const { stack, onRemoveItem, onMoveItem, onRemoveUpcomingStep } = props;
  const listRef = useRef<HTMLDivElement | null>(null);

  const reversedStack = stack.slice().reverse();
  const topTopicId = stack.at(-1)?.id ?? null;

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = 0;
  }, [topTopicId]);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="text-lg font-semibold">Stack</h2>
      <div ref={listRef} className="min-h-0 flex-1 overflow-auto pr-1">
        {stack.length === 0 ? (
          <p className="text-sm text-slate-500">No items in stack.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {reversedStack.map((item, index) => {
              const sourceIndex = stack.length - 1 - index;
              const canMoveDown = sourceIndex > 0;
              const canMoveUp = sourceIndex < stack.length - 1;
              const isTop = sourceIndex === stack.length - 1;

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

                  {isTop ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</div>
                      {item.steps.length === 0 ? (
                        <p className="text-xs text-slate-500">No steps yet for this topic.</p>
                      ) : (
                        <ol className="flex flex-col gap-1">
                          {item.steps.map((step, stepIndex) => {
                            const isCurrentStep = stepIndex === item.activeStepIndex;
                            const isUpcomingStep = stepIndex > item.activeStepIndex;
                            const canRemoveStep = isUpcomingStep && !step.completed;

                            return (
                              <li
                                key={step.id}
                                className={
                                  isCurrentStep
                                    ? "rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-900"
                                    : "rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                                }
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{step.name}</span>
                                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
                                    {isCurrentStep ? <span className="text-sky-700">Current</span> : null}
                                    {step.completed ? <span className="text-emerald-700">Done</span> : null}
                                    {canRemoveStep ? (
                                      <button
                                        className="cursor-pointer rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700"
                                        type="button"
                                        onClick={() => onRemoveUpcomingStep?.(item.id, step.id)}
                                        title="Remove step"
                                      >
                                        x
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}