import { useMemo } from "react";
import { createEngine } from "./game/engine.js";
import { useEngineVersion } from "./hooks/useEngineStore.js";
import { S } from "./game/state.js";
import EntryScreen from "./components/EntryScreen.jsx";
import SelectScreen from "./components/SelectScreen.jsx";
import LobbyScreen from "./components/LobbyScreen.jsx";
import Hud from "./components/Hud.jsx";
import MapStage from "./components/MapStage.jsx";
import ResultScreen from "./components/ResultScreen.jsx";

export default function App() {
  const engine = useMemo(() => createEngine(), []);
  useEngineVersion(engine);

  /* 進場不再自動連線:先讓玩家選建立房間 / 輸入房號,連線由 EntryScreen 觸發。
     連線中也留在 EntryScreen(而不是換成一個「連線中」畫面)——不然一被卸載,
     剛打的房號就沒了,加入失敗時要重打一次。 */
  if (S.phase === "entry" || S.phase === "connecting") return <EntryScreen engine={engine} />;

  if (S.phase === "lobby") {
    const me = S.players[S.myIndex];
    if (!me || !me.cls) return <SelectScreen onPick={(k) => engine.pickClass(k)} />;
    return <LobbyScreen engine={engine} />;
  }

  if (S.phase === "playing") {
    return (
      <div className="wrap">
        <Hud engine={engine} />
        <MapStage engine={engine} />
      </div>
    );
  }

  if (S.phase === "ended") return <ResultScreen />;

  return null;
}
