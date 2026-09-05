import { COINS, CK, UNITS, ZINFO, ROSTER, PACK, SPR_OF, CLASSES, PLAYER_COLORS } from "../game/constants.js";
import { isLocked, lockLeft, ULTS, ULT_CD } from "@noxcat/shared/constants.js";
import { SPRITES } from "../game/sprites.js";
import { CLS_ICON } from "../game/classIcons.js";
import { ZONES } from "@noxcat/shared/board.js";
import { S, money, posValue, unitWorth, settleValue, costOf, cdMulOf, BASE_INCOME, catchUpMul, groupTroops } from "../game/state.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";

function TargetLine() {
  const u = S.units.find(x => x.id === S.selU && x.alive);
  if (u) {
    const r = COINS[u.coin].price / u.entry, pl = (r - 1) * 100;
    return <>已選部隊：<b>{UNITS[u.k].n}</b>（現在值 {money(posValue(u))} 的 {u.coin}
      <span style={{ color: pl >= 0 ? "var(--up)" : "var(--down)" }}>{pl >= 0 ? "▲" : "▼"}{Math.abs(pl).toFixed(1)}%</span>）
      — 按「結算」撤回換成 Cash</>;
  }
  /* 簡化版不用選格子，貓自己找路，所以這一行改成講解鎖狀態，不講目標格。 */
  if (S.mode === "simple") {
    if (!S.unlocked) return <>前 <b>60 秒</b>只能挖礦攢錢 — <b style={{ color: "var(--lime)" }}>{lockLeft(S.t)} 秒</b>後解鎖士兵、刺客與巨獸大招</>;
    return <>貓咪會自己找路 — 礦工去人少的礦區，戰鬥兵去打第一名。點自己的部隊可以結算</>;
  }
  if (S.sel == null) return <>目標區域：<b>未選擇</b> — 點地圖選格子；點自己的部隊可以結算</>;
  const z = ZINFO[ZONES[S.sel][2]];
  return <>目標：<b>{z.t}</b>{z.coin ? ` · 產出 $${z.yield}/s` : ""} — 部隊從基地走過去，只有傘兵能空降</>;
}

function Ticker() {
  return CK.map(k => {
    const c = COINS[k], chg = (c.price / c.ref - 1) * 100, up = chg >= 0, dead = c.price <= 0.002;
    const hot = S.trend && S.trend.c === k;
    let expo = 0, n = 0;
    S.units.forEach(u => { if (u.alive && u.p === S.myIndex && u.coin === k) { expo += unitWorth(u); n++; } });
    return (
      <div className={`tk ${hot ? "hot" : ""}`} key={k}>
        <b style={{ color: c.hex }}>{k}</b>
        <span className="tkp">{dead ? "歸零" : "$" + (c.price < 1 ? c.price.toFixed(3) : c.price.toFixed(2))}</span>
        <span style={{ color: dead ? "var(--down)" : (up ? "var(--up)" : "var(--down)") }}>
          {dead ? "✕" : (up ? "▲" : "▼") + Math.abs(chg).toFixed(0) + "%"}{hot ? (S.trend.rate > 0 ? " ⇡" : " ⇣") : ""}
        </span>
        <span className="tkh" style={{ color: n ? c.hex : "var(--faint)" }}>{n ? money(expo) + "·" + n + "隻" : "—"}</span>
      </div>
    );
  });
}

/* 大招：每個身份一顆,長得跟召喚卡完全不一樣（一顆有文字說明的長按鈕），
   因為它不是「再買一隻貓」,而是一個一次性的場上效果。能不能按的判斷跟
   伺服器 useUlt() 是同一組條件,只是這裡先做給眼睛看,真正的把關在伺服器。 */
function UltButton({ engine, p }) {
  const ult = ULTS[p.cls];
  if (!ult) return null;
  const cd = p.ultCd || 0;
  const locked = p.cls === "degen" && isLocked(S.mode, "titan", S.t);
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

  const sel = S.units.find(x => x.id === S.selU && x.alive);
  const settleAllTotal = mineUnits.reduce((s, u) => s + settleValue(u), 0);
  const autoSell = p.auto === "sell";

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
        <span className="lab">可用 CASH</span>
        <div className="cash num" id="cashBig">{money(p.cash)}</div>
        <div className="ticker" id="ticker"><Ticker /></div>
      </div>
      <div className="sep"></div>
      <div className="dockcol">
        <span className="lab">召喚＝買入 · 1–5　<b id="mecolor" style={{ color: PLAYER_COLORS[S.myIndex] }}>YOU = P{S.myIndex + 1}</b></span>
        <div className="units" id="units">
          {ROSTER.map((k, i) => {
            const u = UNITS[k], c = COINS[u.coin];
            const cd = p.cd[k] || 0, cost = costOf(k, p), dead = c.price <= 0.002;
            const lock = isLocked(S.mode, k, S.t);          // 簡化版前 60 秒的戰鬥兵
            const off = lock || dead || !p.alive || cd > 0 || p.cash < cost;
            const poor = p.cash < cost && cd <= 0;
            const evt = evc === u.coin && !dead;
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
                {lock && <div className="lk"><span>🔒</span><b>{lockLeft(S.t)}s</b></div>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="sep"></div>
      <UltButton engine={engine} p={p} />
      <div className="sep"></div>
      <div className="dockcol">
        <span className="lab">結算＝賣出</span>
        <div className="acts">
          <button className={`a ${!sel ? "off" : ""}`} id="settleOne" onClick={() => engine.settleOne()}>
            <span className="t">結算 <b style={{ fontFamily: "var(--mono)", fontWeight: 400 }}>Q</b></span>
            <span className="d" id="settleInfo">{sel ? `${UNITS[sel.k].n} · ${sel.coin}` : "先點自己的部隊"}</span>
            <span className="p" id="settleVal">{sel ? "取回 " + money(settleValue(sel)) : "—"}</span>
          </button>
          <button className={`a ${!mineUnits.length ? "off" : ""}`} id="settleAll" onClick={() => engine.settleAll()}>
            <span className="t">全部結算 <b style={{ fontFamily: "var(--mono)", fontWeight: 400 }}>E</b></span>
            <span className="d">撤回所有部隊</span>
            <span className="p" id="settleAllVal">{mineUnits.length ? "取回 " + money(settleAllTotal) : "—"}</span>
          </button>
          <button className="a" id="autoBtn" onClick={() => engine.toggleAuto()}>
            <span className="t">產出：{autoSell ? "自動賣出" : "自動持有"}</span>
            <span className="d">{autoSell ? "礦工收益直接換成 Cash" : "收益併進那隻貓身上"}</span>
            <span className="p">點一下切換 · A</span>
          </button>
        </div>
      </div>
    </div>
  );
}
