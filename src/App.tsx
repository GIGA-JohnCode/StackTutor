import { useMemo, useState } from "react";
import { LeftSidebar } from "./components/LeftSidebar";
import { MainFeed } from "./components/MainFeed";
import { RightSidebar } from "./components/RightSidebar";
import { StartSessionView } from "./components/StartSessionView";
import type { SessionListItem, TutorSessionSnapshot } from "./core/types/domain";
import { TutorAppStore } from "./store/TutorAppStore";
import "./App.css";

function App() {
  const appStore = useMemo(() => new TutorAppStore(), []);
  const [isStartView, setIsStartView] = useState(true);
  const [sessions, setSessions] = useState<SessionListItem[]>(() => appStore.getSessionList());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => appStore.getActiveSessionId());
  const [activeSession, setActiveSession] = useState<TutorSessionSnapshot | null>(() => {
    const activeId = appStore.getActiveSessionId();
    return activeId ? appStore.getSessionSnapshotById(activeId) : null;
  });

  const refreshSessions = () => {
    setSessions(appStore.getSessionList());
  };

  const selectSession = (sessionId: string) => {
    appStore.setActiveSessionId(sessionId);
    setActiveSessionId(sessionId);
    setActiveSession(appStore.getSessionSnapshotById(sessionId));
    setIsStartView(false);
  };

  const startSession = (topic: string, maxDepth: number) => {
    const engine = appStore.createEngineForNewSession(topic, maxDepth);
    const snapshot = engine.getSessionSnapshot();
    setActiveSessionId(snapshot.id);
    setActiveSession(snapshot);
    setIsStartView(false);
    refreshSessions();
  };

  return (
    <div className="app-layout">
      <LeftSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onNewSession={() => setIsStartView(true)}
      />

      {isStartView ? (
        <StartSessionView onStartSession={startSession} />
      ) : (
        <MainFeed session={activeSession} />
      )}

      <RightSidebar stack={activeSession?.stack ?? []} />
    </div>
  );
}

export default App;
