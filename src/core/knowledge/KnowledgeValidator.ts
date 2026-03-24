import type { KnowledgeEntry, PrerequisiteCandidate } from "../types/domain";

// Contract for prerequisite validation/trimming.
// MVP uses a pass-through version; later this can be replaced by vector search.
export interface KnowledgeValidator {
  validatePrerequisites(
    generated: PrerequisiteCandidate[],
    knownTopics: Record<string, KnowledgeEntry>,
  ): PrerequisiteCandidate[];
}
