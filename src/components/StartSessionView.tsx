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
    <section className="flex flex-col justify-center gap-2">
      <h1 className="text-xl font-semibold">Start New Session</h1>
      <form onSubmit={onSubmit} className="flex max-w-105 flex-col gap-2">
        <label className="text-sm text-slate-700" htmlFor="topic-input">What do you want to learn?</label>
        <input
          className="rounded-lg border border-slate-300 px-2 py-2 text-slate-900"
          id="topic-input"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="e.g. Dynamic Programming"
        />

        <label className="text-sm text-slate-700" htmlFor="depth-input">Max prerequisite depth</label>
        <select
          className="rounded-lg border border-slate-300 px-2 py-2 text-slate-900"
          id="depth-input"
          value={maxDepth}
          onChange={(event) => setMaxDepth(Number(event.target.value))}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>

        <button
          className="cursor-pointer rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-left text-slate-900"
          type="submit"
        >
          Start Session
        </button>
      </form>
    </section>
  );
}