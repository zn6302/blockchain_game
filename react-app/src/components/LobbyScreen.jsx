import { CLASSES } from "../game/constants.js";
import { S } from "../game/state.js";
import RoomCode from "./RoomCode.jsx";
import { useEngineVersion } from "../hooks/useEngineStore.js";

export default function LobbyScreen({ engine }) {
  useEngineVersion(engine);
  const me = S.players[S.myIndex];
  const humans = S.players.filter(p => !p.isBot).length;
  /* hostIndex < 0 = 伺服器沒指定房主(例如伺服器還沒重啟、schema 是舊的)。
     這時退回「誰都能開始」,而不是變成沒人能開始、整間房卡死。 */
  const noHost = S.hostIndex < 0;
  const isHost = noHost || S.myIndex === S.hostIndex;
  const host = S.players[S.hostIndex];

  return (
    <div className="ov" id="lobbyOv">
      <div className="panel">
        <div className="eyebrow">等待其他玩家</div>
        <h3>你是 {CLASSES[me?.cls]?.n || "?"}，等其他座位準備好</h3>
        <RoomCode />
        <p className="lead">
          目前 {humans} 個真人。人數不到 4 人時，剩下的座位由電腦 bot 接手，
          {noHost
            ? <b style={{ color: "var(--lime)" }}>按「開始遊戲」就開局</b>
            : isHost
              ? <b style={{ color: "var(--lime)" }}>你是房主，按「開始遊戲」就開局</b>
              : <>要等房主<b style={{ color: "var(--lime)" }}>{host?.name || "（房主）"}</b>按開始</>}
          ；四個真人到齊會自動開始。
        </p>
        <div className="classes" id="lobbySeats">
          {S.players.map((p, i) => (
            <div className="cls" key={i} style={{ cursor: "default" }}>
              <div className="cg">
                {i === S.myIndex ? "YOU" : (p.isBot ? "BOT" : "P" + (i + 1))}
                {!noHost && i === S.hostIndex && <span className="hostbadge">房主</span>}
              </div>
              <h4>{p.cls ? CLASSES[p.cls].n : (p.isBot ? "電腦將接手" : "尚未選擇")}</h4>
              <p>{p.isBot ? "這個座位目前是電腦" : (p.name || "玩家")}</p>
            </div>
          ))}
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={() => engine.leaveRoom()}>離開房間</button>
          {/* 開始鍵只給房主。伺服器也擋一次,這裡藏起來只是不讓人白按。 */}
          {isHost
            ? <button className="btn" onClick={() => engine.startNow()}>開始遊戲</button>
            : <span className="hint" style={{ alignSelf: "center" }}>等房主開始…</span>}
        </div>
      </div>
    </div>
  );
}
