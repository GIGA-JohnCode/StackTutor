import { useState } from "react";
import type { TopicItem } from "../core/types/domain";

// Initial landing view that lets the user define what to learn and max prerequisite depth.
interface StartSessionViewProps {
  onStartSession: (
    topic: string,
    maxDepth: number,
    rootProficiency: TopicItem["proficiency"],
    rootContext?: string,
  ) => void;
}

export function StartSessionView(props: StartSessionViewProps) {
  const { onStartSession } = props;
  const [topic, setTopic] = useState("");
  const [maxDepth, setMaxDepth] = useState(2);
  const [rootProficiency, setRootProficiency] = useState<TopicItem["proficiency"]>("beginner");
  const [rootContext, setRootContext] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = topic.trim();
    if (!normalized) {
      return;
    }
    const normalizedContext = rootContext.trim();
    onStartSession(normalized, maxDepth, rootProficiency, normalizedContext || undefined);
  };

  return (
    <section className="st-start-view st-enter">
      <div className="st-start-center">
        <h1 className="st-start-heading">Where should we begin?</h1>
        <form onSubmit={onSubmit} className="st-start-form">
          <div className="st-start-topic-row">
            <input
              className="st-input st-start-topic-input"
              id="topic-input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Topic name"
              aria-label="Topic name"
            />

            <div className="st-start-inline-controls">
              <label className="st-start-mini-control" htmlFor="depth-input">
                <span className="st-start-mini-label">Depth:</span>
                <select
                  className="st-start-mini-select"
                  id="depth-input"
                  value={maxDepth}
                  onChange={(event) => setMaxDepth(Number(event.target.value))}
                  aria-label="Depth"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>

              <label className="st-start-mini-control" htmlFor="root-proficiency-input">
                <span className="st-start-mini-label">Level:</span>
                <select
                  className="st-start-mini-select"
                  id="root-proficiency-input"
                  value={rootProficiency}
                  onChange={(event) => setRootProficiency(event.target.value as TopicItem["proficiency"])}
                  aria-label="Proficiency"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </label>
            </div>
          </div>

          <textarea
            className="st-textarea st-start-context-input"
            id="root-context-input"
            value={rootContext}
            onChange={(event) => setRootContext(event.target.value)}
            placeholder="Add extra context (optional)"
            aria-label="Optional context"
          />

          <button
            className="st-button st-button--primary st-start-submit"
            type="submit"
          >
            Start Session
          </button>
        </form>
      </div>
    </section>
  );
}