import type { KnowledgeEntry, ProficiencyLevel, TopicItem } from "../types/domain";
import type { KnowledgeRepository } from "../persistence/KnowledgeRepository";

// Global knowledge service shared across all sessions.
// This is intentionally repository-backed and injected, not a hard singleton.
export class KnowledgeStore {
  private repository: KnowledgeRepository;
  private knowledge: Record<string, KnowledgeEntry>;

  constructor(repository: KnowledgeRepository) {
    this.repository = repository;
    this.knowledge = this.normalizeKnowledge(this.repository.getAll());
  }

  getAll(): Record<string, KnowledgeEntry> {
    return this.knowledge;
  }

  upsert(topic: string, proficiency: ProficiencyLevel, context: string, confidence?: number): void {
    const key = topic.trim().toLowerCase();
    this.knowledge[key] = {
      topic: {
        name: topic,
        proficiency,
        context: this.normalizeContext(context, topic),
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
      .map((entry) => {
        return `- ${entry.topic.name}: ${entry.topic.proficiency} | context: ${entry.topic.context}`;
      })
      .join("\n");
  }

  private normalizeKnowledge(knowledge: Record<string, KnowledgeEntry>): Record<string, KnowledgeEntry> {
    const normalized: Record<string, KnowledgeEntry> = {};

    for (const [key, entry] of Object.entries(knowledge)) {
      normalized[key] = {
        ...entry,
        topic: this.normalizeTopic(entry.topic),
      };
    }

    return normalized;
  }

  private normalizeTopic(topic: TopicItem): TopicItem {
    return {
      ...topic,
      context: this.normalizeContext(topic.context, topic.name),
    };
  }

  private normalizeContext(rawContext: string | undefined, topicName: string): string {
    const normalized = rawContext?.trim().replace(/\s+/g, " ") ?? "";
    if (normalized) {
      return normalized;
    }

    return `General context for ${topicName}`;
  }
}
