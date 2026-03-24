import type { KnowledgeValidator } from "./KnowledgeValidator";
import type { KnowledgeEntry, PrerequisiteCandidate } from "../types/domain";

// Initial validator implementation.
// For now it removes obvious exact matches against known topics and returns the rest.
export class PassThroughValidator implements KnowledgeValidator {
  validatePrerequisites(
    generated: PrerequisiteCandidate[],
    knownTopics: Record<string, KnowledgeEntry>,
  ): PrerequisiteCandidate[] {
    const knownTopicNames = new Set(
      Object.values(knownTopics).map((entry) => entry.topic.name.toLowerCase()),
    );

    return generated.filter((item) => !knownTopicNames.has(item.topic.toLowerCase()));
  }
}
