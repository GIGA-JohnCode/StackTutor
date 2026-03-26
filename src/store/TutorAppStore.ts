import { ProviderFactory } from "../core/providers/ProviderFactory";
import "../core/providers";
import { KnowledgeStore } from "../core/knowledge/KnowledgeStore";
import { PassThroughValidator } from "../core/knowledge/PassThroughValidator";
import { LangChainLLMClient } from "../core/llm/LangChainLLMClient";
import { TutorSession } from "../core/TutorSession";
import { TutorEngine } from "../core/TutorEngine";
import { LocalKnowledgeRepository } from "../core/persistence/LocalKnowledgeRepository";
import { LocalSessionRepository } from "../core/persistence/LocalSessionRepository";
import { LocalSettingsRepository } from "../core/persistence/LocalSettingsRepository";
import type { AppSettings } from "../core/persistence/SettingsRepository";
import type { SessionListItem, TopicItem, TutorSessionSnapshot } from "../core/types/domain";

// App-level state facade that wires UI events to domain engine operations.
// In later iterations this can be connected to React context, Zustand, or Redux.
export class TutorAppStore {
  private sessionRepository = new LocalSessionRepository();
  private settingsRepository = new LocalSettingsRepository();
  private knowledgeStore = new KnowledgeStore(new LocalKnowledgeRepository());

  getSessionList(): SessionListItem[] {
    return this.sessionRepository.getSessionList();
  }

  getActiveSessionId(): string | null {
    return this.sessionRepository.getActiveSessionId();
  }

  setActiveSessionId(sessionId: string | null): void {
    this.sessionRepository.setActiveSessionId(sessionId);
  }

  getSessionSnapshotById(sessionId: string): TutorSessionSnapshot | null {
    return this.sessionRepository.getById(sessionId);
  }

  saveSessionSnapshot(snapshot: TutorSessionSnapshot): void {
    this.sessionRepository.upsert(snapshot);
  }

  removeSession(sessionId: string): void {
    this.sessionRepository.remove(sessionId);
  }

  getSettings(): AppSettings {
    return this.settingsRepository.get();
  }

  saveSettings(settings: AppSettings): void {
    this.settingsRepository.save(settings);
  }

  isByokConfigured(): boolean {
    const settings = this.settingsRepository.get();
    return Boolean(settings.apiKey?.trim());
  }

  createEngineForNewSession(
    topic: string,
    maxDepth: number,
    rootProficiency: TopicItem["proficiency"],
  ): TutorEngine {
    const settings = this.settingsRepository.get();
    if (!settings.apiKey?.trim()) {
      throw new Error("Set your Groq API key in BYOK settings before starting a session.");
    }

    const provider = ProviderFactory.getProvider(settings.providerName, {
      apiKey: settings.apiKey,
      modelName: settings.modelName,
    });
    const llmClient = new LangChainLLMClient(provider);

    const session = TutorSession.createNew(
      crypto.randomUUID(),
      topic,
      maxDepth,
    );

    const engine = new TutorEngine(
      session,
      llmClient,
      new PassThroughValidator(),
      this.knowledgeStore,
    );
    engine.startWithRootTopic(topic, rootProficiency);

    this.sessionRepository.upsert(session.getSnapshot());
    this.sessionRepository.setActiveSessionId(session.getSnapshot().id);

    return engine;
  }

  createEngineForSession(sessionId: string): TutorEngine | null {
    const snapshot = this.sessionRepository.getById(sessionId);
    if (!snapshot) {
      return null;
    }

    const settings = this.settingsRepository.get();
    const provider = ProviderFactory.getProvider(settings.providerName, {
      apiKey: settings.apiKey,
      modelName: settings.modelName,
    });
    const llmClient = new LangChainLLMClient(provider);
    const session = TutorSession.fromSnapshot(snapshot);

    this.sessionRepository.setActiveSessionId(sessionId);

    return new TutorEngine(
      session,
      llmClient,
      new PassThroughValidator(),
      this.knowledgeStore,
    );
  }

  // TODO: add methods for loading/saving session snapshots and switching active session.
}