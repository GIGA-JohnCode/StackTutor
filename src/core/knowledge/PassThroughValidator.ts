import type { KnowledgeValidator } from "./KnowledgeValidator";
import type { TopicItem } from "../types/domain";

// Current validator is intentionally a strict no-op pass-through.
// Filtering logic will be added in a later iteration.
export class PassThroughValidator implements KnowledgeValidator {
  validatePrerequisites(generated: TopicItem[]): TopicItem[] {
    return generated;
  }
}
