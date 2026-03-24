import type { SessionListItem, TutorSessionSnapshot } from "../types/domain";

// Repository contract for session snapshots and active-session pointer.
export interface SessionRepository {
  getSessionList(): SessionListItem[];
  getById(sessionId: string): TutorSessionSnapshot | null;
  upsert(session: TutorSessionSnapshot): void;
  remove(sessionId: string): void;
  getActiveSessionId(): string | null;
  setActiveSessionId(sessionId: string | null): void;
}
