import { S, money, posTotal, netWorth } from "../game/state.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";

export default function Hud({ engine }) {
  useEngineVersion(engine);
  const players = S.players;
  const rank = [...players].sort((a, b) => netWorth(b) - netWorth(a));
  const top = rank[0];
  const place = rank.findIndex(p => p.me) + 1;
  const t = Math.max(0, S.t), m = Math.floor(t / 60), sec = Math.floor(t % 60);
  const timeTxt = `${m}:${String(sec).padStart(2, "0")}`;

  return (
    <header className="hud">
      <div className="brand">
        <div className="mark">N</div>
        <div><h1>區塊鏈大戰爭</h1><span>NOXCAT ARENA · 4P</span></div>
      </div>
      <div className="players" id="players">
        {players.map(p => {
          const w = netWorth(p), pct = Math.max(0, Math.min(100, w / p.start * 100));
          const n = S.units.filter(u => u.p === p.i && u.alive).length;
          return (
            <div className={`pl ${p.me ? "me" : ""} ${p.alive ? "" : "dead"}`} key={p.i}>
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
        <div className="leadchip" id="leadchip" style={{ display: "flex" }}>
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
    </header>
  );
}
