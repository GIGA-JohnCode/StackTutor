import { TutorSession } from "./TutorSession";
import { StackManager } from "./StackManager";
import { KnowledgeStore } from "./knowledge/KnowledgeStore";
import type { KnowledgeValidator } from "./knowledge/KnowledgeValidator";
import type { LLMClient } from "./llm/LLMClient";
import { parsePrerequisites } from "./llm/parsers";
import type { StackItem, TopicItem, TutorSessionSnapshot } from "./types/domain";

// Deterministic orchestration engine for the tutor workflow.
// This is the heart of business logic and should remain UI-framework agnostic.
export class TutorEngine {
  private session: TutorSession;
  private llmClient: LLMClient;
  private validator: KnowledgeValidator;
  private knowledgeStore: KnowledgeStore;

  constructor(
    session: TutorSession,
    llmClient: LLMClient,
    validator: KnowledgeValidator,
    knowledgeStore: KnowledgeStore,
  ) {
    this.session = session;
    this.llmClient = llmClient;
    this.validator = validator;
    this.knowledgeStore = knowledgeStore;
  }

  startWithRootTopic(topic: string, proficiency: TopicItem["proficiency"]): void {
    const root: StackItem = {
      id: `topic:${topic.toLowerCase()}`,
      topic: {
        name: topic,
        proficiency,
      },
      depth: 0,
      prerequisitesSearched: false,
      steps: [],
      activeStepIndex: 0,
    };

    this.session.setStack([root]);
    this.session.setStatus("active");
  }

  getSessionSnapshot(): TutorSessionSnapshot {
    return this.session.getSnapshot();
  }

  async expandTopIfNeeded(maxPrereqs = 5): Promise<TopicItem[]> {
    const stackManager = new StackManager(this.session.getSnapshot().stack);
    const top = stackManager.peekTop();

    if (!top) {
      this.session.setStatus("completed");
      return [];
    }

    if (top.prerequisitesSearched || top.depth >= this.session.getSnapshot().maxDepth) {
      return [];
    }

    const rawOutput = await this.llmClient.generatePrerequisites({
      topic: top.topic,
      maxItems: maxPrereqs,
      knownTopicsContext: this.knowledgeStore.toLLMContext(),
    });

    const generated = parsePrerequisites(rawOutput, {
      targetTopic: top.topic.name,
      maxItems: maxPrereqs,
    });

    const validated = this.validator.validatePrerequisites(generated);

    top.prerequisitesSearched = true;
    this.session.setStack(stackManager.getStack());

    return validated;
  }

  applyAcceptedPrerequisites(parentTopicId: string, accepted: TopicItem[]): void {
    const stackManager = new StackManager(this.session.getSnapshot().stack);
    stackManager.pushPrerequisitesAbove(parentTopicId, accepted);
    this.session.setStack(stackManager.getStack());
  }

  // TODO: implement decomposition, completeStep, proceed, and retry handlers.
}