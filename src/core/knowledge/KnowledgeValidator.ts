import type { TopicItem } from "../types/domain";

// Contract for prerequisite validation/trimming.
// MVP uses a pass-through version; later this can be replaced by vector search.
export interface KnowledgeValidator {
  validatePrerequisites(generated: TopicItem[]): TopicItem[];
}
