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
     連線錯誤(房號不存在、房間已滿…)也回到 EntryScreen 就地顯示。 */
  if (S.phase === "entry") return <EntryScreen engine={engine} />;

  if (S.phase === "connecting") {
    return (
      <div className="ov">
        <div className="panel">
          <div className="eyebrow">NOXCAT ARENA</div>
          <h3>連線中…</h3>
        </div>
      </div>
    );
  }

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
