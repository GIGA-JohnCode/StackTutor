import type { KnowledgeEntry, ProficiencyLevel } from "../types/domain";
import type { KnowledgeRepository } from "../persistence/KnowledgeRepository";

// Global knowledge service shared across all sessions.
// This is intentionally repository-backed and injected, not a hard singleton.
export class KnowledgeStore {
  private repository: KnowledgeRepository;
  private knowledge: Record<string, KnowledgeEntry>;

  constructor(repository: KnowledgeRepository) {
    this.repository = repository;
    this.knowledge = this.repository.getAll();
  }

  getAll(): Record<string, KnowledgeEntry> {
    return this.knowledge;
  }

  upsert(topic: string, proficiency: ProficiencyLevel, confidence?: number): void {
    const key = topic.trim().toLowerCase();
    this.knowledge[key] = {
      topic: {
        name: topic,
        proficiency,
      },
      confidence,
      lastReviewedAt: new Date().toISOString(),
    };
    this.repository.saveAll(this.knowledge);
  }

  hasTopic(topic: string): boolean {
    return Boolean(this.knowledge[topic.trim().toLowerCase()]);
  }

  toLLMContext(): string {
    const entries = Object.values(this.knowledge);
    if (entries.length === 0) {
      return "No known topics yet.";
    }

    return entries
      .map((entry) => `- ${entry.topic.name}: ${entry.topic.proficiency}`)
      .join("\n");
  }
}
