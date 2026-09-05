import { S, money, posTotal, netWorth } from "../game/state.js";
import { SFX } from "../game/audio.js";
import { NOX_MARK, NOX_WORD } from "../game/classIcons.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";

export default function Hud({ engine }) {
  useEngineVersion(engine);
  const players = S.players;
  const rank = [...players].sort((a, b) => netWorth(b) - netWorth(a));
  const top = rank[0];
  const place = rank.findIndex(p => (p.i === S.myIndex)) + 1;
  const t = Math.max(0, S.t), m = Math.floor(t / 60), sec = Math.floor(t % 60);
  const timeTxt = `${m}:${String(sec).padStart(2, "0")}`;

  return (
    <header className="hud">
      <div className="brand">
        <img className="mark" src={NOX_MARK} alt="" />
        <div><h1><img src={NOX_WORD} alt="NoxFlow" /></h1><span>4P · 3 分鐘</span></div>
      </div>
      <div className="players" id="players">
        {players.map(p => {
          const w = netWorth(p), pct = Math.max(0, Math.min(100, w / p.start * 100));
          const n = S.units.filter(u => u.p === p.i && u.alive).length;
          return (
            <div className={`pl ${(p.i === S.myIndex) ? "me" : ""} ${p.alive ? "" : "dead"}`} key={p.i}>
              <div className="row">
                <div className="nm">
                  <i className="dot" style={{ background: p.color }}></i>
                  <span className="pname">{p.name}</span>
                  <span className="pshort">P{p.i + 1}</span>
                </div>
                <div className="val" style={{ color: p.color }}>{money(w)}</div>
              </div>
              <div className="bar"><i style={{ width: pct + "%", background: p.color }}></i></div>
              <div className="sub">現金 {money(p.cash)} · 場上 {money(posTotal(p))} · {n} 兵</div>
            </div>
          );
        })}
      </div>
      {top && (
        <div className="leadchip" id="leadchip">
          <span>你第 {place} 名</span>
          <span style={{ color: "var(--faint)" }}>·</span>
          <i style={{ background: top.color }}></i>
          <span>領先 <b style={{ color: top.color }}>{money(netWorth(top))}</b></span>
        </div>
      )}
      <div className={`clock ${t <= 30 ? "warn" : ""}`} id="clock">
        <div className="t num" id="timer">{timeTxt}</div>
        <div className="l">TIME LEFT</div>
      </div>
      {/* 手機直式限定：原本浮在地圖右上角的兩顆鍵挪到這裡,地圖上緣就整條讓給事件卡。
          桌機的 .zoomctl 還有 ＋／− 縮放,那邊維持原樣（CSS 控制誰出現）。 */}
      <div className="mapctl">
        <button title="回到我的基地" onClick={() => engine.homeCamera()}>⌂</button>
        <button title="音效" className={SFX.on ? "on" : ""} onClick={() => engine.toggleSfx()}>
          {SFX.on ? "🔊" : "🔇"}
        </button>
      </div>
    </header>
  );
}
