# Stack Tutor

Stack Tutor is a browser-first AI tutoring application that decomposes a target topic into prerequisites and stepwise lessons, then guides the learner through each step interactively.

The app is fully BYOK (Bring Your Own Key): all model calls are made client-side using user-provided provider credentials stored in localStorage.

## Core Capabilities

- Recursive prerequisite expansion with user review before stack insertion.
- Step decomposition and focused micro-lesson generation per active topic.
- Interactive lesson controls: Proceed, Retry, and Doubt.
- Global knowledge memory shared across sessions to reduce repeated teaching.
- Multi-provider BYOK support (Groq, OpenRouter, Google) with provider-scoped credentials.
- Session persistence and resume support.
- In-app operation status updates for slow LLM operations.

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- LangChain client SDKs:
  - @langchain/groq
  - @langchain/openrouter
  - @langchain/google-genai
- LocalStorage-based repositories for settings, sessions, and knowledge

## High-Level Architecture

The project uses a layered, domain-first architecture:

- UI Layer: React components under src/components and app orchestration in src/App.tsx.
- Application Layer: src/store/TutorAppStore.ts as facade between UI and domain.
- Domain Layer: TutorEngine, TutorSession, StackManager, shared domain types.
- LLM Layer: LLMClient contract + LangChainLLMClient implementation + parser/schema boundary.
- Provider Layer: factory + provider registration + task-model selection.
- Persistence Layer: repository interfaces and LocalStorage implementations.
- Cross-Cutting: scoped singleton logger used throughout the stack.

## Project Structure

```text
src/
  components/
    ByokSettingsPanel.tsx
    LeftSidebar.tsx
    MainFeed.tsx
    RightSidebar.tsx
    StartSessionView.tsx
  core/
    knowledge/
    llm/
    logging/
    persistence/
    providers/
    types/
    StackManager.ts
    TutorEngine.ts
    TutorSession.ts
  store/
    TutorAppStore.ts
  App.tsx
  main.tsx
  index.css
```

## Data Model Summary

- TopicItem: topic name, target proficiency, context scope.
- StackItem: topic + depth + prerequisite state + decomposition steps + active step pointer.
- StepItem: id, name, objective, completion flag.
- TutorSessionSnapshot: full session state persisted in localStorage.
- KnowledgeEntry: normalized learned-topic entry used to build model context.

## Runtime Workflow

1. User configures provider credentials in BYOK settings.
2. User starts a session with topic, max depth, target proficiency, optional context.
3. Engine evaluates top-of-stack:
   - expands prerequisites if allowed,
   - asks user to accept/dismiss suggestions,
   - decomposes topic into ordered steps,
   - generates a lesson for the active step.
4. User drives progression:
   - Proceed marks step complete and advances or pops topic,
   - Retry regenerates lesson for same step,
   - Doubt appends user question and tutor clarification.
5. Completed topics are upserted into global knowledge store.

## BYOK Provider Behavior

- Registered providers are discovered at runtime via src/core/providers/loadProviders.ts.
- Active provider selection is persisted in settings.
- Credentials and model overrides are persisted per provider in providerSettings.
- Top-level settings.apiKey/modelName always reflect the currently selected provider.

## Operation Status and UX Feedback

During LLM-bound actions, the app surfaces operation progress messages such as:

- Fetching prerequisites...
- Fetching steps...
- Generating lesson...

Status appears near the bottom of the feed (close to where users read latest content), and action controls are temporarily disabled while operations are in-flight.

## Persistence Details

All persistence is localStorage-based:

- Sessions index: stackTutor.sessions.index.v1
- Sessions data map: stackTutor.sessions.data.v1
- Active session id: stackTutor.activeSessionId.v1
- Settings: stackTutor.settings.v1
- Knowledge: stackTutor.knowledge.v1

Legacy monolithic sessions (stackTutor.sessions.v1) are migrated automatically.

## Development

### Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

### Install

```bash
npm install
```

### Run Dev Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Preview Production Build

```bash
npm run preview
```

## Security Notes

- API keys are stored in browser localStorage for BYOK flows.
- This is suitable for local/dev use, but not equivalent to server-side secret management.
- Do not use production secrets in shared/public browser profiles.

## Known Limitations

- No backend sync or multi-device state consistency.
- PassThroughValidator currently applies no semantic filtering.
- Limited automated test coverage at this stage.
- Bundle size is currently large because all provider clients are shipped to browser.

## Extension Guide

### Add a New Provider

1. Create src/core/providers/YourProvider.provider.ts.
2. Implement ModelProvider.getModel(task).
3. Register via registerProvider("yourprovider")(YourProvider).
4. Provide sensible default modelByTask mappings.

No manual barrel edits are needed if filename matches *.provider.ts.

### Add New Engine Action

1. Add deterministic domain method in TutorEngine.
2. Expose action through TutorAppStore facade.
3. Call from App.tsx handlers and wire UI controls.
4. Persist snapshot updates through existing store helper.

## License

See LICENSE.
