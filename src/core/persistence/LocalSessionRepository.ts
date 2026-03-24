import { STORAGE_KEYS } from "./StorageKeys";
import type { SessionRepository } from "./SessionRepository";
import type { SessionListItem, TutorSessionSnapshot } from "../types/domain";

// LocalStorage implementation for session list/detail retrieval.
export class LocalSessionRepository implements SessionRepository {
  getSessionList(): SessionListItem[] {
    this.migrateLegacyStoreIfNeeded();
    return this.readIndex();
  }

  getById(sessionId: string): TutorSessionSnapshot | null {
    this.migrateLegacyStoreIfNeeded();
    const data = this.readData();
    return data[sessionId] ?? null;
  }

  upsert(session: TutorSessionSnapshot): void {
    this.migrateLegacyStoreIfNeeded();

    const data = this.readData();
    data[session.id] = session;
    this.writeData(data);

    const index = this.readIndex();
    const listItem: SessionListItem = {
      id: session.id,
      title: session.title,
      status: session.status,
      updatedAt: session.updatedAt,
    };

    const existingIdx = index.findIndex((item) => item.id === session.id);
    if (existingIdx < 0) {
      index.push(listItem);
    } else {
      index[existingIdx] = listItem;
    }

    index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.writeIndex(index);
  }

  remove(sessionId: string): void {
    this.migrateLegacyStoreIfNeeded();

    const data = this.readData();
    delete data[sessionId];
    this.writeData(data);

    const index = this.readIndex().filter((item) => item.id !== sessionId);
    this.writeIndex(index);

    if (this.getActiveSessionId() === sessionId) {
      this.setActiveSessionId(null);
    }
  }

  getActiveSessionId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.activeSessionId);
  }

  setActiveSessionId(sessionId: string | null): void {
    if (!sessionId) {
      localStorage.removeItem(STORAGE_KEYS.activeSessionId);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.activeSessionId, sessionId);
  }

  private readIndex(): SessionListItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.sessionsIndex);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as SessionListItem[];
    } catch {
      return [];
    }
  }

  private writeIndex(index: SessionListItem[]): void {
    localStorage.setItem(STORAGE_KEYS.sessionsIndex, JSON.stringify(index));
  }

  private readData(): Record<string, TutorSessionSnapshot> {
    const raw = localStorage.getItem(STORAGE_KEYS.sessionsData);
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw) as Record<string, TutorSessionSnapshot>;
    } catch {
      return {};
    }
  }

  private writeData(data: Record<string, TutorSessionSnapshot>): void {
    localStorage.setItem(STORAGE_KEYS.sessionsData, JSON.stringify(data));
  }

  private readLegacySessions(): TutorSessionSnapshot[] {
    const raw = localStorage.getItem(STORAGE_KEYS.sessions);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as TutorSessionSnapshot[];
    } catch {
      return [];
    }
  }

  private migrateLegacyStoreIfNeeded(): void {
    const hasIndex = localStorage.getItem(STORAGE_KEYS.sessionsIndex) !== null;
    const hasData = localStorage.getItem(STORAGE_KEYS.sessionsData) !== null;

    if (hasIndex || hasData) {
      return;
    }

    const legacy = this.readLegacySessions();
    if (legacy.length === 0) {
      return;
    }

    const data: Record<string, TutorSessionSnapshot> = {};
    const index: SessionListItem[] = legacy.map((session) => {
      data[session.id] = session;
      return {
        id: session.id,
        title: session.title,
        status: session.status,
        updatedAt: session.updatedAt,
      };
    });

    index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.writeData(data);
    this.writeIndex(index);
  }
}
