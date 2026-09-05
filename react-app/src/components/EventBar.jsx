import { COINS, COIN_UNITS, CLASSES } from "../game/constants.js";
import { TREND_T } from "../game/economy.js";
import { S } from "../game/state.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";

export default function EventBar({ engine }) {
  useEngineVersion(engine);
  const lead = (S.cls && CLASSES[S.cls].lead) || 6;
  const warnPhase = (!S.trend && S.pending && S.evtT <= lead && S.evtT > 0);
  if (!S.trend && !warnPhase) return <div className="evtbar" id="evtbar" />;

  const coin = S.trend ? S.trend.c : S.pending.c, c = COINS[coin];
  const up = S.trend ? S.trend.rate > 0 : S.pending.f >= 1;
  const units = COIN_UNITS[coin];
  const pct = Math.round((c.price / c.ref - 1) * 100);
  const t = S.trend ? S.trend.t : S.evtT, tot = S.trend ? TREND_T : lead;
  const insight = S.cls && CLASSES[S.cls].insight && !S.trend
    ? `（預估 ${S.pending.f >= 1 ? "+" : "−"}${Math.round(Math.abs(S.pending.f - 1) * 100)}%）` : "";

  return (
    <div className="evtbar on" id="evtbar">
      <div className="ehead">
        <span>{S.trend ? (up ? "📈" : "📉") : "📰"} <b>{S.trend ? S.trend.t2 : S.pending.w}</b></span>
        <span className="eco" style={{ color: c.hex }}>
          {coin} ${c.price < 1 ? c.price.toFixed(3) : c.price.toFixed(2)}
          <span style={{ color: pct >= 0 ? "var(--up)" : "var(--down)" }}>
            {pct >= 0 ? "▲" : "▼"}{Math.abs(pct)}%
          </span>
        </span>
      </div>
      <div className="esub">
        {S.trend
          ? <>
            <b style={{ color: c.hex }}>{units}</b> 的召喚價正在{up ? "變貴" : "變便宜"}
            {up ? " — 手上的先結算可以獲利" : " — 現在買比較划算"}
          </>
          : <>
            再 {Math.ceil(S.evtT)} 秒開始 · 會影響 <b style={{ color: c.hex }}>{units}</b>
            （{up ? "可能變貴" : "可能變便宜"}）{insight}
          </>}
      </div>
      <div className="ebar"><i style={{ width: Math.max(0, Math.min(100, t / tot * 100)).toFixed(0) + "%", background: c.hex }}></i></div>
    </div>
  );
}
