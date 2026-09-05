import { useEffect, useRef, useState } from "react";
import { S } from "../game/state.js";
import { ROSTER } from "../game/constants.js";
import { SFX } from "../game/audio.js";
import { createMapView } from "../game/mapEngine.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";
import Toast from "./Toast.jsx";
import EventBar from "./EventBar.jsx";
import TroopPanel from "./TroopPanel.jsx";
import Dock from "./Dock.jsx";

function Legend({ engine }) {
  useEngineVersion(engine);
  return (
    <div className="legend" id="legend">
      {S.players.map(p => (
        <span key={p.i}><i style={{ background: p.color }}></i>{p.name}</span>
      ))}
    </div>
  );
}

export default function MapStage({ engine }) {
  useEngineVersion(engine);
  const svgRef = useRef(null);
  const viewRef = useRef(null);
  const [introOn, setIntroOn] = useState(true);

  useEffect(() => {
    const view = createMapView(svgRef.current);
    viewRef.current = view;
    engine.setMapView(view);
    view.render();
    view.attachInteraction({ onSelectUnit: (id) => engine.selectUnit(id) });
    view.setInitialCamera();
    setIntroOn(true);
    const t = setTimeout(() => setIntroOn(false), 2600);

    const onKeydown = (e) => {
      if (!S.running) return;
      const i = parseInt(e.key, 10);
      if (i >= 1 && i <= ROSTER.length) { engine.summon(ROSTER[i - 1]); return; }
      if (i === ROSTER.length + 1) { engine.useUlt(); return; }   // 6 = 大招
      const k = e.key.toLowerCase();
      if (k === "q") engine.settleOne();
      if (k === "e") engine.settleAll();
    };
    addEventListener("keydown", onKeydown);

    return () => {
      clearTimeout(t);
      removeEventListener("keydown", onKeydown);
      engine.setMapView(null);
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stage">
      <svg className="map" id="map" ref={svgRef} viewBox="0 0 940 640" preserveAspectRatio="xMidYMid slice"
        role="img" aria-label="六邊形戰場"></svg>

      <Legend engine={engine} />
      <div className="zoomctl">
        <button className="zbtn" title="放大" onClick={() => viewRef.current && viewRef.current.zoomIn()}>＋</button>
        <button className="zbtn" title="縮小" onClick={() => viewRef.current && viewRef.current.zoomOut()}>−</button>
        <button title="回到我的基地" onClick={() => viewRef.current && viewRef.current.home()}>⌂</button>
        <button title="音效" className={SFX.on ? "on" : ""} onClick={() => engine.toggleSfx()}>{SFX.on ? "🔊" : "🔇"}</button>
      </div>
      <div className={`intro ${introOn ? "on" : ""}`} id="intro">這是你的基地</div>
      <EventBar engine={engine} />
      <Toast />

      <TroopPanel engine={engine} />
      <Dock engine={engine} />
    </div>
  );
}
