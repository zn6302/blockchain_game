import { useMemo, useState } from "react";
import { createEngine } from "./game/engine.js";
import { useEngineVersion } from "./hooks/useEngineStore.js";
import { S } from "./game/state.js";
import SelectScreen from "./components/SelectScreen.jsx";
import Hud from "./components/Hud.jsx";
import MapStage from "./components/MapStage.jsx";
import ResultScreen from "./components/ResultScreen.jsx";

export default function App() {
  const engine = useMemo(() => createEngine(), []);
  const [clsKey, setClsKey] = useState(null);
  useEngineVersion(engine);

  return (
    <>
      {!clsKey && <SelectScreen onPick={setClsKey} />}
      {clsKey && (
        <div className="wrap">
          <Hud engine={engine} />
          <MapStage engine={engine} clsKey={clsKey} />
        </div>
      )}
      {S.over && <ResultScreen />}
    </>
  );
}
