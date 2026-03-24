import type { KnowledgeEntry } from "../types/domain";

// Repository contract for global learned-topic knowledge.
// Implement this with LocalStorage now and replace later if backend sync is added.
export interface KnowledgeRepository {
  getAll(): Record<string, KnowledgeEntry>;
  saveAll(knowledge: Record<string, KnowledgeEntry>): void;
}
