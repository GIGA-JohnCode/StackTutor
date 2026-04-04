import type { DecomposeOutput, PrerequisiteOutput } from "./schemas";
import type { ProficiencyLevel, StepItem, TopicItem } from "../types/domain";

export function parsePrerequisites(
  output: PrerequisiteOutput,
  options: { targetTopic: string; maxItems: number },
): TopicItem[] {
  if (!Array.isArray(output.prerequisites)) {
    throw new Error("Prerequisite payload is missing 'prerequisites' array");
  }

  const root = normalizeTopicName(options.targetTopic).toLowerCase();
  const maxItems = clampInt(options.maxItems, 1, 8, 5);
  const seen = new Set<string>();
  const topics: TopicItem[] = [];

  for (const item of output.prerequisites) {
    const name = normalizeTopicName(item?.name ?? "");
    if (!name) {
      continue;
    }

    const lowered = name.toLowerCase();
    if (lowered === root || seen.has(lowered)) {
      continue;
    }

    seen.add(lowered);
    topics.push({
      name,
      proficiency: normalizeProficiency(item.proficiency),
      context: normalizeTopicContext(item.context, name),
    });

    if (topics.length >= maxItems) {
      break;
    }
  }

  return topics;
}

export function parseDecompositionSteps(
  output: DecomposeOutput,
  options: { topic: TopicItem; maxItems: number },
): StepItem[] {
  if (!Array.isArray(output.steps)) {
    throw new Error("Decompose payload is missing 'steps' array");
  }

  const maxItems = clampInt(options.maxItems, 2, 12, 6);
  const seen = new Set<string>();
  const steps: StepItem[] = [];

  for (let index = 0; index < output.steps.length; index += 1) {
    const rawItem = output.steps[index];
    const name = normalizeStepName(rawItem?.name ?? "");
    const objective = normalizeTopicName(rawItem?.objective ?? "");

    if (!name || !objective) {
      continue;
    }

    const dedupeKey = objective.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    const stepIndex = steps.length;

    steps.push({
      id: buildStepId(options.topic.name, name, stepIndex),
      name,
      objective,
      completed: false,
    });

    if (steps.length >= maxItems) {
      break;
    }
  }

  return steps;
}

function normalizeTopicName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function normalizeTopicContext(raw: string, topicName: string): string {
  const normalized = normalizeTopicName(raw);
  if (normalized) {
    return normalized;
  }

  return `Context for ${topicName}`;
}

function normalizeStepName(raw: string): string {
  return normalizeTopicName(raw).slice(0, 80);
}

function normalizeProficiency(raw: string): ProficiencyLevel {
  switch (raw.trim().toLowerCase()) {
    case "beginner":
    case "intermediate":
    case "advanced":
    case "expert":
      return raw.trim().toLowerCase() as ProficiencyLevel;
    default:
      return "beginner";
  }
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function buildStepId(topic: string, stepName: string, index: number): string {
  const topicSlug = toSlug(topic);
  const stepSlug = toSlug(stepName).slice(0, 24);
  const hash = hashString(`${topicSlug}|${stepSlug}|${String(index)}`);
  return `step:${topicSlug}:${String(index)}:${stepSlug}:${hash}`;
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function hashString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
