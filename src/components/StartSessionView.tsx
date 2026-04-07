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
    <section className="st-panel st-enter flex flex-col justify-center gap-2 p-3">
      <h1 className="st-title text-xl">Start New Session</h1>
      <p className="st-subtitle">Define your learning target and Stack Tutor will build the path.</p>
      <form onSubmit={onSubmit} className="st-form-grid max-w-110">
        <label className="st-label" htmlFor="topic-input">What do you want to learn?</label>
        <input
          className="st-input"
          id="topic-input"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="e.g. Dynamic Programming"
        />

        <label className="st-label" htmlFor="depth-input">Max prerequisite depth</label>
        <select
          className="st-select"
          id="depth-input"
          value={maxDepth}
          onChange={(event) => setMaxDepth(Number(event.target.value))}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>

        <label className="st-label" htmlFor="root-proficiency-input">Root topic proficiency</label>
        <select
          className="st-select"
          id="root-proficiency-input"
          value={rootProficiency}
          onChange={(event) => setRootProficiency(event.target.value as TopicItem["proficiency"])}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>

        <label className="st-label" htmlFor="root-context-input">Optional context</label>
        <textarea
          className="st-textarea"
          id="root-context-input"
          value={rootContext}
          onChange={(event) => setRootContext(event.target.value)}
          placeholder="e.g. I need recommender systems for e-commerce product ranking and personalization."
        />

        <button
          className="st-button st-button--primary text-left"
          type="submit"
        >
          Start Session
        </button>
      </form>
    </section>
  );
}