// Centralized LocalStorage keys. Add schema version suffixes when making breaking changes.
export const STORAGE_KEYS = {
  // Legacy monolithic session store (kept temporarily for migration).
  sessions: "stackTutor.sessions.v1",
  // New split stores for efficient list/detail retrieval.
  sessionsIndex: "stackTutor.sessions.index.v1",
  sessionsData: "stackTutor.sessions.data.v1",
  activeSessionId: "stackTutor.activeSessionId.v1",
  settings: "stackTutor.settings.v1",
  knowledge: "stackTutor.knowledge.v1",
} as const;
