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

        <label className="text-sm text-slate-700" htmlFor="root-proficiency-input">Root topic proficiency</label>
        <select
          className="rounded-lg border border-slate-300 px-2 py-2 text-slate-900"
          id="root-proficiency-input"
          value={rootProficiency}
          onChange={(event) => setRootProficiency(event.target.value as TopicItem["proficiency"])}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
        </select>

        <label className="text-sm text-slate-700" htmlFor="root-context-input">Optional context</label>
        <textarea
          className="min-h-24 rounded-lg border border-slate-300 px-2 py-2 text-slate-900"
          id="root-context-input"
          value={rootContext}
          onChange={(event) => setRootContext(event.target.value)}
          placeholder="e.g. I need recommender systems for e-commerce product ranking and personalization."
        />

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