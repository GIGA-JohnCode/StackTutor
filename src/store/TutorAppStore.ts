import { ProviderFactory } from "../core/providers/ProviderFactory";
import "../core/providers";
import { getLogger } from "../core/logging/Logger";
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
  TeachingTokenUpdate,
} from "../core/llm/LLMClient";
import type {
  PendingPrerequisiteReview,
  SessionListItem,
  StepItem,
  TopicItem,
  TutorMessage,
  TutorSessionSnapshot,
} from "../core/types/domain";

const logger = getLogger("TutorAppStore");

// App-level state facade that wires UI events to domain engine operations.
// In later iterations this can be connected to React context, Zustand, or Redux.
export class TutorAppStore {
  private sessionRepository = new LocalSessionRepository();
  private settingsRepository = new LocalSettingsRepository();
  private knowledgeStore = new KnowledgeStore(new LocalKnowledgeRepository());
  private keylessProviders = new Set(["ollama"]);

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

    logger.info("Setting active session", { sessionId });
    this.sessionRepository.setActiveSessionId(sessionId);
  }

  getSessionSnapshotById(sessionId: string): TutorSessionSnapshot | null {
    return this.sessionRepository.getById(sessionId);
  }

  saveSessionSnapshot(snapshot: TutorSessionSnapshot): void {
    logger.debug("Persisting session snapshot", { sessionId: snapshot.id });
    this.sessionRepository.upsert(snapshot);
  }

  removeSession(sessionId: string): void {
    const wasActive = this.sessionRepository.getActiveSessionId() === sessionId;
    logger.info("Removing session", { sessionId, wasActive });
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
    logger.info("Saving settings", {
      providerName: settings.providerName,
      hasApiKey: Boolean(settings.apiKey?.trim()),
      hasModelName: Boolean(settings.modelName?.trim()),
    });
    this.settingsRepository.save(settings);
  }

  getAvailableProviders(): string[] {
    return ProviderFactory.getRegisteredNames().sort();
  }

  isByokConfigured(): boolean {
    const settings = this.settingsRepository.get();
    if (!this.providerRequiresApiKey(settings.providerName)) {
      return true;
    }

    return Boolean(settings.apiKey?.trim());
  }

  createEngineForNewSession(
    topic: string,
    maxDepth: number,
    rootProficiency: TopicItem["proficiency"],
    rootContext?: string,
  ): TutorEngine {
    logger.info("Creating engine for new session", {
      topic,
      maxDepth,
      rootProficiency,
      hasRootContext: Boolean(rootContext?.trim()),
    });
    const settings = this.settingsRepository.get();
    if (this.providerRequiresApiKey(settings.providerName) && !settings.apiKey?.trim()) {
      logger.warn("Cannot create new session engine: API key missing");
      throw new Error("Set your provider API key in BYOK settings before starting a session.");
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
    engine.startWithRootTopic(topic, rootProficiency, rootContext);

    this.sessionRepository.upsert(session.getSnapshot());
    this.sessionRepository.setActiveSessionId(session.getSnapshot().id);

    logger.info("Created engine for new session", {
      sessionId: session.getSnapshot().id,
      providerName: settings.providerName,
    });

    return engine;
  }

  createEngineForSession(sessionId: string): TutorEngine | null {
    logger.debug("Creating engine for existing session", { sessionId });
    const snapshot = this.sessionRepository.getById(sessionId);
    if (!snapshot) {
      logger.warn("Cannot create engine: session not found", { sessionId });
      return null;
    }

    const settings = this.settingsRepository.get();
    if (this.providerRequiresApiKey(settings.providerName) && !settings.apiKey?.trim()) {
      throw new Error("Set your provider API key in BYOK settings before continuing this session.");
    }

    const provider = ProviderFactory.getProvider(settings.providerName, {
      apiKey: settings.apiKey,
      modelName: settings.modelName,
    });
    const llmClient = new LangChainLLMClient(provider);
    const session = TutorSession.fromSnapshot(snapshot);

    this.sessionRepository.setActiveSessionId(sessionId);

    logger.debug("Created engine for existing session", { sessionId, providerName: settings.providerName });

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

    logger.info("Switching active session", { sessionId });
    this.sessionRepository.setActiveSessionId(sessionId);
    return snapshot;
  }

  async expandTopIfNeeded(sessionId: string, maxPrereqs = 5): Promise<{
    suggested: TopicItem[];
    pending: PendingPrerequisiteReview | null;
    snapshot: TutorSessionSnapshot;
  }> {
    logger.debug("Expanding top if needed", { sessionId, maxPrereqs });
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
    logger.info("Accepting pending prerequisites", { sessionId, parentTopicId, acceptedCount: accepted.length });
    const engine = this.requireEngine(sessionId);
    engine.applyAcceptedPrerequisites(parentTopicId, accepted);
    return this.persistEngineSnapshot(engine);
  }

  dismissPendingPrerequisites(sessionId: string, parentTopicId: string): TutorSessionSnapshot {
    logger.info("Dismissing pending prerequisites", { sessionId, parentTopicId });
    const engine = this.requireEngine(sessionId);
    engine.dismissPendingPrerequisites(parentTopicId);
    return this.persistEngineSnapshot(engine);
  }

  async teachCurrentStep(
    sessionId: string,
    mode: "initial" | "doubt",
    doubt?: string,
    onToken?: (update: TeachingTokenUpdate) => void,
  ): Promise<{ message: TutorMessage | null; snapshot: TutorSessionSnapshot }> {
    logger.debug("Teaching current step", { sessionId, mode, hasDoubt: Boolean(doubt?.trim()) });
    const engine = this.requireEngine(sessionId);
    const message = await engine.teachCurrentStep(mode, doubt, onToken);
    const snapshot = this.persistEngineSnapshot(engine);
    return { message, snapshot };
  }

  async decomposeTopIfNeeded(
    sessionId: string,
    stepCountHint?: number,
  ): Promise<{ steps: StepItem[]; snapshot: TutorSessionSnapshot }> {
    logger.debug("Decomposing top if needed", { sessionId, stepCountHint });
    const engine = this.requireEngine(sessionId);
    const steps = await engine.decomposeTopIfNeeded(stepCountHint);
    const snapshot = this.persistEngineSnapshot(engine);
    return { steps, snapshot };
  }

  async retryCurrentStep(
    sessionId: string,
    onToken?: (update: TeachingTokenUpdate) => void,
  ): Promise<{ message: TutorMessage | null; snapshot: TutorSessionSnapshot }> {
    logger.info("Retrying current step", { sessionId });
    const engine = this.requireEngine(sessionId);
    const message = await engine.retryCurrentStep(onToken);
    const snapshot = this.persistEngineSnapshot(engine);
    return { message, snapshot };
  }

  async askStepDoubt(
    sessionId: string,
    question: string,
    onToken?: (update: TeachingTokenUpdate) => void,
  ): Promise<{ messages: { user: TutorMessage; tutor: TutorMessage } | null; snapshot: TutorSessionSnapshot }> {
    logger.info("Submitting step doubt", { sessionId, questionLength: question.trim().length });
    const engine = this.requireEngine(sessionId);
    const messages = await engine.askStepDoubt(question, onToken);
    const snapshot = this.persistEngineSnapshot(engine);
    return { messages, snapshot };
  }

  proceedCurrentStep(sessionId: string): {
    advanced: boolean;
    completedTopic?: TopicItem;
    sessionCompleted: boolean;
    snapshot: TutorSessionSnapshot;
  } {
    logger.info("Proceeding current step", { sessionId });
    const engine = this.requireEngine(sessionId);
    const result = engine.proceedCurrentStep();
    const snapshot = this.persistEngineSnapshot(engine);
    return {
      ...result,
      snapshot,
    };
  }

  removeStackItem(sessionId: string, itemId: string): TutorSessionSnapshot {
    logger.info("Removing stack item", { sessionId, itemId });
    const engine = this.requireEngine(sessionId);
    engine.removeStackItem(itemId);
    return this.persistEngineSnapshot(engine);
  }

  moveStackItem(sessionId: string, fromIndex: number, toIndex: number): TutorSessionSnapshot {
    logger.info("Moving stack item", { sessionId, fromIndex, toIndex });
    const engine = this.requireEngine(sessionId);
    engine.moveStackItem(fromIndex, toIndex);
    return this.persistEngineSnapshot(engine);
  }

  removeUpcomingStep(sessionId: string, topicId: string, stepId: string): TutorSessionSnapshot {
    logger.info("Removing upcoming step", { sessionId, topicId, stepId });
    const engine = this.requireEngine(sessionId);
    engine.removeUpcomingStep(topicId, stepId);
    return this.persistEngineSnapshot(engine);
  }

  private requireEngine(sessionId: string): TutorEngine {
    const engine = this.createEngineForSession(sessionId);
    if (!engine) {
      logger.error("Required engine is missing", { sessionId });
      throw new Error(`Session '${sessionId}' not found.`);
    }

    return engine;
  }

  private persistEngineSnapshot(engine: TutorEngine): TutorSessionSnapshot {
    const snapshot = engine.getSessionSnapshot() as TutorSessionSnapshot;
    logger.debug("Persisting engine snapshot", { sessionId: snapshot.id });
    this.sessionRepository.upsert(snapshot);
    return snapshot;
  }

  private providerRequiresApiKey(providerName: string): boolean {
    const normalized = providerName.trim().toLowerCase();
    return !this.keylessProviders.has(normalized);
  }
}