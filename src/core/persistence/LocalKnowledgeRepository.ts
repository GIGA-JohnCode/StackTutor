import type { KnowledgeEntry } from "../types/domain";
import { getLogger } from "../logging/Logger";
import type { KnowledgeRepository } from "./KnowledgeRepository";
import { STORAGE_KEYS } from "./StorageKeys";

const logger = getLogger("LocalKnowledgeRepository");

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
      logger.warn("Failed to parse knowledge store; returning empty map");
      return {};
    }
  }

  saveAll(knowledge: Record<string, KnowledgeEntry>): void {
    logger.debug("Saving knowledge store", { entryCount: Object.keys(knowledge).length });
    localStorage.setItem(STORAGE_KEYS.knowledge, JSON.stringify(knowledge));
  }
}
