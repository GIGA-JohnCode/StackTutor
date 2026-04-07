import { useEffect, useRef } from "react";
import type { StackItem } from "../core/types/domain";

// Shows editable learning stack for the active session.
// Must support reorder and remove actions initiated by the user.
interface RightSidebarProps {
  stack: StackItem[];
  isBusy?: boolean;
  onRemoveItem?: (itemId: string) => void;
  onMoveItem?: (fromIndex: number, toIndex: number) => void;
  onRemoveUpcomingStep?: (topicId: string, stepId: string) => void;
}

export function RightSidebar(props: RightSidebarProps) {
  const {
    stack,
    isBusy = false,
    onRemoveItem,
    onMoveItem,
    onRemoveUpcomingStep,
  } = props;
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
    <aside className="st-panel st-sidebar st-enter">
      <h2 className="st-title">Learning Stack</h2>
      <div ref={listRef} className="st-scroll">
        {stack.length === 0 ? (
          <p className="st-subtitle">No items in stack.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {reversedStack.map((item, index) => {
              const sourceIndex = stack.length - 1 - index;
              const canMoveDown = sourceIndex > 0;
              const canMoveUp = sourceIndex < stack.length - 1;
              const isTop = sourceIndex === stack.length - 1;

              return (
                <div key={item.id} className="st-topic-card">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{item.topic.name}</div>
                      <small className="st-subtitle">Depth {item.depth}</small>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        className="st-button st-button--ghost st-icon-btn"
                        type="button"
                        onClick={() => onMoveItem?.(sourceIndex, sourceIndex - 1)}
                        disabled={isBusy || !canMoveDown}
                        aria-label="Move topic down"
                        title="Move topic down"
                      >
                        ↓
                      </button>
                      <button
                        className="st-button st-button--ghost st-icon-btn"
                        type="button"
                        onClick={() => onMoveItem?.(sourceIndex, sourceIndex + 1)}
                        disabled={isBusy || !canMoveUp}
                        aria-label="Move topic up"
                        title="Move topic up"
                      >
                        ↑
                      </button>
                      <button
                        className="st-button st-button--danger st-icon-btn st-icon-btn--danger"
                        type="button"
                        onClick={() => onRemoveItem?.(item.id)}
                        disabled={isBusy}
                        aria-label="Remove topic from stack"
                        title="Remove topic from stack"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {isTop ? (
                    <div className="st-step-list">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Active Topic Steps</div>
                      {item.steps.length === 0 ? (
                        <p className="st-subtitle text-xs">No steps yet for this topic.</p>
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
                                    ? "st-step-item st-step-item--current"
                                    : "st-step-item"
                                }
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span>{step.name}</span>
                                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                                    {isCurrentStep ? <span className="text-sky-700">Current</span> : null}
                                    {step.completed ? <span className="text-emerald-700">Done</span> : null}
                                    {canRemoveStep ? (
                                      <button
                                        className="st-button st-button--danger st-icon-btn st-icon-btn--danger st-icon-btn--compact"
                                        type="button"
                                        onClick={() => onRemoveUpcomingStep?.(item.id, step.id)}
                                        title="Remove step"
                                        disabled={isBusy}
                                        aria-label="Remove step"
                                      >
                                        ×
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