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
import type {
  PendingPrerequisiteReview,
  SessionListItem,
  TopicItem,
  TutorMessage,
  TutorSessionSnapshot,
} from "../core/types/domain";

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
    if (sessionId && !this.sessionRepository.getById(sessionId)) {
      throw new Error(`Cannot activate missing session '${sessionId}'.`);
    }

    this.sessionRepository.setActiveSessionId(sessionId);
  }

  getSessionSnapshotById(sessionId: string): TutorSessionSnapshot | null {
    return this.sessionRepository.getById(sessionId);
  }

  saveSessionSnapshot(snapshot: TutorSessionSnapshot): void {
    this.sessionRepository.upsert(snapshot);
  }

  removeSession(sessionId: string): void {
    const wasActive = this.sessionRepository.getActiveSessionId() === sessionId;
    this.sessionRepository.remove(sessionId);

    if (wasActive) {
      const next = this.sessionRepository.getSessionList()[0];
      this.sessionRepository.setActiveSessionId(next?.id ?? null);
    }
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

  switchActiveSession(sessionId: string): TutorSessionSnapshot {
    const snapshot = this.sessionRepository.getById(sessionId);
    if (!snapshot) {
      throw new Error(`Session '${sessionId}' not found.`);
    }

    this.sessionRepository.setActiveSessionId(sessionId);
    return snapshot;
  }

  async expandTopIfNeeded(sessionId: string, maxPrereqs = 5): Promise<{
    suggested: TopicItem[];
    pending: PendingPrerequisiteReview | null;
    snapshot: TutorSessionSnapshot;
  }> {
    const engine = this.requireEngine(sessionId);
    const suggested = await engine.expandTopIfNeeded(maxPrereqs);
    const snapshot = this.persistEngineSnapshot(engine);
    return {
      suggested,
      pending: engine.getPendingPrerequisiteReview(),
      snapshot,
    };
  }

  acceptPendingPrerequisites(
    sessionId: string,
    parentTopicId: string,
    accepted: TopicItem[],
  ): TutorSessionSnapshot {
    const engine = this.requireEngine(sessionId);
    engine.applyAcceptedPrerequisites(parentTopicId, accepted);
    return this.persistEngineSnapshot(engine);
  }

  dismissPendingPrerequisites(sessionId: string, parentTopicId: string): TutorSessionSnapshot {
    const engine = this.requireEngine(sessionId);
    engine.dismissPendingPrerequisites(parentTopicId);
    return this.persistEngineSnapshot(engine);
  }

  async teachCurrentStep(
    sessionId: string,
    mode: "initial" | "doubt",
    doubt?: string,
  ): Promise<{ message: TutorMessage | null; snapshot: TutorSessionSnapshot }> {
    const engine = this.requireEngine(sessionId);
    const message = await engine.teachCurrentStep(mode, doubt);
    const snapshot = this.persistEngineSnapshot(engine);
    return { message, snapshot };
  }

  async retryCurrentStep(
    sessionId: string,
  ): Promise<{ message: TutorMessage | null; snapshot: TutorSessionSnapshot }> {
    const engine = this.requireEngine(sessionId);
    const message = await engine.retryCurrentStep();
    const snapshot = this.persistEngineSnapshot(engine);
    return { message, snapshot };
  }

  async askStepDoubt(
    sessionId: string,
    question: string,
  ): Promise<{ messages: { user: TutorMessage; tutor: TutorMessage } | null; snapshot: TutorSessionSnapshot }> {
    const engine = this.requireEngine(sessionId);
    const messages = await engine.askStepDoubt(question);
    const snapshot = this.persistEngineSnapshot(engine);
    return { messages, snapshot };
  }

  proceedCurrentStep(sessionId: string): {
    advanced: boolean;
    completedTopic?: TopicItem;
    sessionCompleted: boolean;
    snapshot: TutorSessionSnapshot;
  } {
    const engine = this.requireEngine(sessionId);
    const result = engine.proceedCurrentStep();
    const snapshot = this.persistEngineSnapshot(engine);
    return {
      ...result,
      snapshot,
    };
  }

  removeStackItem(sessionId: string, itemId: string): TutorSessionSnapshot {
    const engine = this.requireEngine(sessionId);
    engine.removeStackItem(itemId);
    return this.persistEngineSnapshot(engine);
  }

  moveStackItem(sessionId: string, fromIndex: number, toIndex: number): TutorSessionSnapshot {
    const engine = this.requireEngine(sessionId);
    engine.moveStackItem(fromIndex, toIndex);
    return this.persistEngineSnapshot(engine);
  }

  private requireEngine(sessionId: string): TutorEngine {
    const engine = this.createEngineForSession(sessionId);
    if (!engine) {
      throw new Error(`Session '${sessionId}' not found.`);
    }

    return engine;
  }

  private persistEngineSnapshot(engine: TutorEngine): TutorSessionSnapshot {
    const snapshot = engine.getSessionSnapshot() as TutorSessionSnapshot;
    this.sessionRepository.upsert(snapshot);
    return snapshot;
  }
}