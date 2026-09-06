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
        <div className="eyebrow">{humans} / 4 真人</div>
        <h3>你是 {CLASSES[me?.cls]?.n || "?"}</h3>
        <RoomCode />
        {/* 「誰能按開始」不寫進這句:房主看得到開始鍵、非房主看得到下面的提示,
            按鈕本身就說明了誰能動手。這句只留房間規則。 */}
        <p className="lead">空位由電腦補，四個真人都選好身份後會自動開始。</p>
        <div className="classes" id="lobbySeats">
          {S.players.map((p, i) => (
            <div className="cls" key={i} style={{ cursor: "default" }}>
              <div className="cg">
                {i === S.myIndex ? "YOU" : (p.isBot ? "BOT" : "P" + (i + 1))}
                {!noHost && i === S.hostIndex && <span className="hostbadge">房主</span>}
              </div>
              {/* 上面的角標已經寫了 BOT,這裡再寫「電腦將接手」「這個座位目前是電腦」
                  是同一件事講三次。第二行改講一件新的:真人加入會直接接管這個位子。 */}
              <h4>{p.cls ? CLASSES[p.cls].n : (p.isBot ? "電腦" : "尚未選擇")}</h4>
              <p>{p.isBot ? "有人加入就換人坐" : (p.name || "玩家")}</p>
            </div>
          ))}
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={() => engine.leaveRoom()}>離開房間</button>
          {/* 開始鍵只給房主。伺服器也擋一次,這裡藏起來只是不讓人白按。 */}
          {isHost
            ? <button className="btn" onClick={() => engine.startNow()}>開始遊戲</button>
            : <span className="hint" style={{ alignSelf: "center" }}>等 {host?.name || "房主"} 開始…</span>}
        </div>
      </div>
    </div>
  );
}
