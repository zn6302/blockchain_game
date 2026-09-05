import { CLASSES } from "../game/constants.js";
import { S } from "../game/state.js";
import RoomCode from "./RoomCode.jsx";
import { useEngineVersion } from "../hooks/useEngineStore.js";

export default function LobbyScreen({ engine }) {
  useEngineVersion(engine);
  const me = S.players[S.myIndex];
  const humans = S.players.filter(p => !p.isBot).length;

  return (
    <div className="ov" id="lobbyOv">
      <div className="panel">
        <div className="eyebrow">等待其他玩家</div>
        <h3>你是 {CLASSES[me?.cls]?.n || "?"}，等其他座位準備好</h3>
        <RoomCode />
        <p className="lead">
          目前 {humans} 個真人。人數不到 4 人時，剩下的座位由電腦 bot 接手，
          <b style={{ color: "var(--lime)" }}>任何人按「開始遊戲」就開局</b>；四個真人到齊會自動開始。
        </p>
        <div className="classes" id="lobbySeats">
          {S.players.map((p, i) => (
            <div className="cls" key={i} style={{ cursor: "default" }}>
              <div className="cg">{i === S.myIndex ? "YOU" : (p.isBot ? "BOT" : "P" + (i + 1))}</div>
              <h4>{p.cls ? CLASSES[p.cls].n : (p.isBot ? "電腦將接手" : "尚未選擇")}</h4>
              <p>{p.isBot ? "這個座位目前是電腦" : (p.name || "玩家")}</p>
            </div>
          ))}
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={() => engine.leaveRoom()}>離開房間</button>
          <button className="btn" onClick={() => engine.startNow()}>開始遊戲</button>
        </div>
      </div>
    </div>
  );
}
