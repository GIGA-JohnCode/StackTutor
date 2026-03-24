import type { KnowledgeEntry } from "../types/domain";
import type { KnowledgeRepository } from "./KnowledgeRepository";
import { STORAGE_KEYS } from "./StorageKeys";

// LocalStorage implementation of the knowledge repository contract.
export class LocalKnowledgeRepository implements KnowledgeRepository {
  getAll(): Record<string, KnowledgeEntry> {
    const raw = localStorage.getItem(STORAGE_KEYS.knowledge);
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as Record<string, KnowledgeEntry>;
    } catch {
      return {};
    }
  }

  saveAll(knowledge: Record<string, KnowledgeEntry>): void {
    localStorage.setItem(STORAGE_KEYS.knowledge, JSON.stringify(knowledge));
  }
}
