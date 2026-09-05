import { useEffect, useMemo } from "react";
import { createEngine } from "./game/engine.js";
import { useEngineVersion } from "./hooks/useEngineStore.js";
import { S } from "./game/state.js";
import SelectScreen from "./components/SelectScreen.jsx";
import LobbyScreen from "./components/LobbyScreen.jsx";
import Hud from "./components/Hud.jsx";
import MapStage from "./components/MapStage.jsx";
import ResultScreen from "./components/ResultScreen.jsx";

export default function App() {
  const engine = useMemo(() => createEngine(), []);
  useEngineVersion(engine);

  useEffect(() => {
    engine.connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (S.connectError) {
    return (
      <div className="ov">
        <div className="panel">
          <div className="eyebrow">連線失敗</div>
          <h3>連不到伺服器</h3>
          <p className="lead">{S.connectError}</p>
        </div>
      </div>
    );
  }

  if (!S.connected || S.phase === "connecting") {
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
