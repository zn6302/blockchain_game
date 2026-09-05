import { COINS, CK, UNITS, ROSTER, PACK, SPR_OF, CLASSES, PLAYER_COLORS } from "../game/constants.js";
import { isLocked, lockLeft, ULTS, ULT_CD } from "@noxcat/shared/constants.js";
import { SPRITES } from "../game/sprites.js";
import { CLS_ICON } from "../game/classIcons.js";
import { S, clamp, money, posValue, unitWorth, costOf, cdMulOf, BASE_INCOME, catchUpMul, groupTroops } from "../game/state.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";
import { useMediaQuery, TROOP_PANEL_HIDDEN } from "../hooks/useMediaQuery.js";
import SettleActions from "./SettleActions.jsx";

function TargetLine() {
  const u = S.units.find(x => x.id === S.selU && x.alive);
  if (u) {
    const r = COINS[u.coin].price / u.entry, pl = (r - 1) * 100;
    return <>已選部隊：<b>{UNITS[u.k].n}</b>（現在值 {money(posValue(u))} 的 {u.coin}
      <span style={{ color: pl >= 0 ? "var(--up)" : "var(--down)" }}>{pl >= 0 ? "▲" : "▼"}{Math.abs(pl).toFixed(1)}%</span>）
      — 按「結算」撤回換成 Cash</>;
  }
  /* 玩家不選格子，貓自己找路，所以這一行講的是解鎖狀態，不是目標格。 */
  if (!S.unlocked) return <>前 <b>60 秒</b>只能挖礦攢錢 — <b style={{ color: "var(--lime)" }}>{lockLeft(S.t)} 秒</b>後解鎖士兵、刺客與巨獸大招</>;
  return <>礦工自己會去礦區、士兵自己會去找對手 — 你只要決定<b>買什麼</b>和<b>什麼時候賣</b></>;
}

/* 走勢線：把一段價格壓進 w×ht 的框裡。剛開場整段是平的，所以給一個最小幅度，
   不然除以 0 之後整條線會變成一根尖刺。 */
function sparkPath(h, w, ht) {
  if (!h || h.length < 2) return `0,${(ht / 2).toFixed(1)} ${w},${(ht / 2).toFixed(1)}`;
  const lo = Math.min(...h), hi = Math.max(...h), mid = (hi + lo) / 2;
  const sp = Math.max(hi - lo, Math.abs(mid) * 0.10, 1e-6);
  const y0 = mid - sp / 2;
  return h.map((v, i) => `${(i / (h.length - 1) * w).toFixed(1)},${
    clamp(ht - 3 - (v - y0) / sp * (ht - 6), 1, ht - 1).toFixed(1)}`).join(" ");
}
/* 高度交給 CSS（media query 要調得動），viewBox 只負責座標系與線的粗細 */
function Spark({ hist, up, w, h }) {
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={sparkPath((hist || []).slice(-30), w, h)} fill="none"
        stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.6"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* 幣價欄有兩種長相，差別是這局有幾種幣：
   簡化版只有一種幣，那支幣就是整個市場，所以給它大字價格＋一整條走勢圖；
   完整版三種幣要能並排比較，就縮成一行一支、走勢圖跟在行末。 */
function coinExposure(k) {
  let expo = 0, n = 0;
  S.units.forEach(u => { if (u.alive && u.p === S.myIndex && u.coin === k) { expo += unitWorth(u); n++; } });
  return { expo, n };
}
function SoloTicker({ k }) {
  const c = COINS[k], chg = (c.price / c.ref - 1) * 100, up = chg >= 0, dead = c.price <= 0.002;
  const hot = !!(S.trend && S.trend.c === k);
  const { expo, n } = coinExposure(k);
  return (
    <div className={`ticker ${hot ? "hot" : ""}`} id="ticker">
      <div className="prow">
        <span className="pv">{dead ? "歸零" : "$" + (c.price < 1 ? c.price.toFixed(3) : c.price.toFixed(2))}</span>
        <span className="pc" style={{ color: dead ? "var(--down)" : (up ? "var(--up)" : "var(--down)") }}>
          {dead ? "✕" : (up ? "▲" : "▼") + Math.abs(chg).toFixed(0) + "%"}{hot ? (S.trend.rate > 0 ? " ⇡" : " ⇣") : ""}
        </span>
      </div>
      <Spark hist={c.hist} up={up} w={132} h={26} />
      <div className="phold">場上 <b style={{ color: n ? "var(--lime)" : "var(--faint)" }}>
        {n ? money(expo) + " · " + n + " 隻" : "沒有貓"}</b></div>
    </div>
  );
}
function MultiTicker() {
  return (
    <div className="ticker" id="ticker">
      {CK.map(k => {
        const c = COINS[k], chg = (c.price / c.ref - 1) * 100, up = chg >= 0, dead = c.price <= 0.002;
        const hot = !!(S.trend && S.trend.c === k);
        const { expo, n } = coinExposure(k);
        return (
          <div className={`tk ${hot ? "hot" : ""}`} key={k}>
            <b style={{ color: c.hex }}>{k}</b>
            <span className="tkp">{dead ? "歸零" : "$" + (c.price < 1 ? c.price.toFixed(3) : c.price.toFixed(2))}</span>
            <span style={{ color: dead ? "var(--down)" : (up ? "var(--up)" : "var(--down)") }}>
              {dead ? "✕" : (up ? "▲" : "▼") + Math.abs(chg).toFixed(0) + "%"}{hot ? (S.trend.rate > 0 ? " ⇡" : " ⇣") : ""}
            </span>
            <Spark hist={c.hist} up={up} w={44} h={13} />
            <span className="tkh" style={{ color: n ? c.hex : "var(--faint)" }}>{n ? money(expo) + "·" + n + "隻" : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
function Ticker() {
  return CK.length === 1 ? <SoloTicker k={CK[0]} /> : <MultiTicker />;
}

/* 大招：每個身份一顆,長得跟召喚卡完全不一樣（一顆有文字說明的長按鈕），
   因為它不是「再買一隻貓」,而是一個一次性的場上效果。能不能按的判斷跟
   伺服器 useUlt() 是同一組條件,只是這裡先做給眼睛看,真正的把關在伺服器。 */
function UltButton({ engine, p }) {
  const ult = ULTS[p.cls];
  if (!ult) return null;
  const cd = p.ultCd || 0;
  const locked = p.cls === "degen" && isLocked("titan", S.t);
  const poor = p.cash < ult.min;
  const off = !p.alive || cd > 0 || locked || poor;
  const firing = S.flashKey === "ult" && performance.now() < S.flashUntil;
  const status = cd > 0 ? `冷卻中 · 還要 ${Math.ceil(cd)} 秒`
    : locked ? `${lockLeft(S.t)} 秒後解鎖`
      : poor ? `還差 ${money(ult.min - p.cash)}`
        : `每 ${ULT_CD} 秒一次 · 點我發動`;
  return (
    <div className="dockcol ultcol">
      <span className="lab">每 {ULT_CD} 秒一次</span>
      <button className={`ultbtn ${off ? "off" : "ready"} ${firing ? "fire" : ""}`} id="ultBtn"
        onClick={() => engine.useUlt()}>
        <i className="ucd" style={{ width: cd > 0 ? (cd / ULT_CD * 100).toFixed(1) + "%" : 0 }}></i>
        <span className="uhead">
          <img src={CLS_ICON[p.cls]} alt="" />
          <b>{ult.n}</b><i className="ug">大招 · 6</i>
        </span>
        <span className="ud">{ult.d}</span>
        <span className="us">{status}</span>
      </button>
    </div>
  );
}

export default function Dock({ engine }) {
  useEngineVersion(engine);
  /* hook 要在 early return 之前呼叫,順序每次 render 都得一樣 */
  const panelHidden = useMediaQuery(TROOP_PANEL_HIDDEN);
  const p = S.players[S.myIndex];
  if (!p) return null;

  const mineUnits = S.units.filter(u => u.alive && u.p === S.myIndex);
  const gs = groupTroops(mineUnits);

  const list = ROSTER.filter(k => COINS[UNITS[k].coin].price > 0.002)
    .map(k => ({ k, c: costOf(k, p) })).sort((a, b) => a.c - b.c);
  const cheap = list[0];
  const broke = p.alive && !mineUnits.length && cheap && p.cash < cheap.c;

  const lead = (p.cls && CLASSES[p.cls].lead) || 6;
  const evc = S.trend ? S.trend.c : ((S.pending && S.evtT <= lead && S.evtT > 0) ? S.pending.c : null);
  const now = performance.now();

  return (
    <div className="dock">
      <div className="target" id="target"><TargetLine /></div>
      <div className="tstrip" id="tstrip">
        {!gs.length && !broke && <span className="tempty2">場上沒有部隊 — 按下面的貓咪召喚</span>}
        {gs.map(o => {
          const ch = COINS[o.coin], hot = o.pl >= 12;
          return (
            <button className={`tchip ${o.sel ? "on" : ""} ${o.fight ? "fight" : ""} ${hot ? "cash" : ""}`}
              key={o.k + "|" + o.coin} onClick={() => engine.focusUnit(o.units[0])}>
              <img src={SPRITES[SPR_OF[o.k] || o.k].w[0]} alt="" />
              <span className="cw">
                <span className="cp" style={{ color: o.pl >= 0 ? "var(--up)" : "var(--down)" }}>
                  ×{o.n} {(o.pl >= 0 ? "+" : "") + o.pl.toFixed(0)}%
                </span>
                <span className="cb"><i style={{ width: (o.hp * 100).toFixed(0) + "%", background: o.hp > 0.5 ? ch.hex : "var(--down)" }}></i></span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={`helper ${broke ? "on" : ""}`} id="helper">
        {broke && cheap && (() => {
          const inc = BASE_INCOME * catchUpMul(p) * (CLASSES[p.cls].incMul || 1);
          const need = cheap.c - p.cash, secs = Math.max(1, Math.ceil(need / Math.max(0.1, inc)));
          const relief = Math.max(0, Math.ceil(p.reliefT == null ? 4 : p.reliefT));
          return (
            <>
              <b>沒錢，場上也沒有貓？別擔心，你不會就這樣輸掉。</b><br />
              基地每秒自動進 <b style={{ color: "var(--lime)" }}>${inc.toFixed(1)}</b>　·
              再 <b style={{ color: "var(--mid)" }}>{secs} 秒</b>就買得起 <b>{UNITS[cheap.k].n}×{PACK}（${cheap.c}）</b>　·
              <span style={{ color: "var(--faint)" }}>{relief} 秒後系統還會免費配一批礦工給你</span>
              <div className="hb"><i style={{ width: Math.max(4, Math.min(100, p.cash / cheap.c * 100)).toFixed(0) + "%" }}></i></div>
            </>
          );
        })()}
      </div>
      <div className="dockcol cashcol">
        <span className="lab">可用 CASH · NOXCAT 幣價</span>
        <div className="cash num" id="cashBig">{money(p.cash)}</div>
        <Ticker />
      </div>
      <div className="sep"></div>
      <div className="dockcol">
        <span className="lab">召喚＝買入 · 1–5　<b id="mecolor" style={{ color: PLAYER_COLORS[S.myIndex] }}>YOU = P{S.myIndex + 1}</b></span>
        <div className="units" id="units">
          {ROSTER.map((k, i) => {
            const u = UNITS[k], c = COINS[u.coin];
            const cd = p.cd[k] || 0, cost = costOf(k, p), dead = c.price <= 0.002;
            const lock = isLocked(k, S.t);                  // 開場 60 秒鎖住的戰鬥兵
            const off = lock || dead || !p.alive || cd > 0 || p.cash < cost;
            const poor = p.cash < cost && cd <= 0;
            const evt = !lock && evc === u.coin && !dead;
            const full = u.cd * cdMulOf(p) || 1;
            const firing = S.flashKey === k && now < S.flashUntil;
            return (
              <button className={`u ${off ? "off" : ""} ${lock ? "lock" : ""} ${dead ? "rug" : ""} ${poor ? "poor" : ""} ${evt ? "evt" : ""} ${firing ? "fire" : ""}`}
                data-u={k} key={k} style={evt ? { color: c.hex } : undefined}
                onPointerDown={(e) => { e.preventDefault(); engine.summon(k); }}>
                <i className="cstrip" style={{ background: c.hex }}></i>
                <span className="k">{i + 1}</span>
                <img className="uimg" src={SPRITES[SPR_OF[k] || k].w[0]} alt="" />
                <div className="n">{u.n}<b className="px">×{PACK}</b></div>
                <div className="c">${cost}</div>
                <div className="cd" style={cd > 0 ? { display: "flex", height: Math.min(100, cd / full * 100) + "%" } : { display: "none" }}>
                  {cd > 0 ? cd.toFixed(1) : ""}
                </div>
                {lock && <div className="lk"><span className="lkb"><i>🔒</i><b>{lockLeft(S.t)}s</b></span></div>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="sep"></div>
      <UltButton engine={engine} p={p} />
      {/* 桌機的結算列在右側「我的部隊」面板底下,只有面板被收起來時才回到這裡 */}
      {panelHidden && <><div className="sep"></div><SettleActions engine={engine} /></>}
    </div>
  );
}
