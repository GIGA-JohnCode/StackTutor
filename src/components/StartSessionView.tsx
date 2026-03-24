import { useState } from "react";

// Initial landing view that lets the user define what to learn and max prerequisite depth.
interface StartSessionViewProps {
  onStartSession: (topic: string, maxDepth: number) => void;
}

export function StartSessionView(props: StartSessionViewProps) {
  const { onStartSession } = props;
  const [topic, setTopic] = useState("");
  const [maxDepth, setMaxDepth] = useState(2);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = topic.trim();
    if (!normalized) {
      return;
    }
    onStartSession(normalized, maxDepth);
  };

  return (
    <section className="panel panel-main start-view">
      <h1>Start New Session</h1>
      <form onSubmit={onSubmit} className="start-form">
        <label htmlFor="topic-input">What do you want to learn?</label>
        <input
          id="topic-input"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="e.g. Dynamic Programming"
        />

        <label htmlFor="depth-input">Max prerequisite depth</label>
        <select
          id="depth-input"
          value={maxDepth}
          onChange={(event) => setMaxDepth(Number(event.target.value))}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>

        <button type="submit">Start Session</button>
      </form>
    </section>
  );
}