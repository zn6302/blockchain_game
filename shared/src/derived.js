import { CLASSES, PACK, ORDER_ALL, UNITS } from "./constants.js";
import { ZONES, hexXY, ZINFO } from "./board.js";

/**
 * 這裡的函式是遊戲平衡公式(手續費、礦區產出遞減、幣價對戰力的映射...),
 * client(顯示用)跟 server(結算用)都要算出同樣的數字,所以共用同一份,
 * 不是各自維護一份容易兩邊算出不同結果的複製品。
 *
 * 每個函式吃一個 `ctx = {S, COINS}`:
 *   S      — 該局遊戲的可變狀態(server 端每個房間一個、client 端每個分頁一個)
 *   COINS  — 該局的幣價狀態(同上,一局一份,由 shared/constants.js 的 createCoins() 產生)
 */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const money = (v) => "$" + Math.round(v).toLocaleString();

/* ---- 部位：每個場上單位就是一筆持倉 ---- */
export function posValue(ctx, u) { return u.qty * ctx.COINS[u.coin].price; }          // 部位現值
export function unitWorth(ctx, u) { return posValue(ctx, u) * (u.hp / u.hpMax); }        // 受傷會折損
export function posTotal(ctx, p) { let w = 0; ctx.S.units.forEach(u => { if (u.alive && u.p === p.i) w += unitWorth(ctx, u); }); return w; }
export function netWorth(ctx, p) { return p.cash + posTotal(ctx, p); }
export function atZone(u) { const z = ZONES[u.z], { x, y } = hexXY(z[0], z[1]); return Math.hypot(x - u.x, y - u.y) < 46; }
export function hasUnitOn(ctx, pi, type) { return ctx.S.units.some(u => u.alive && u.p === pi && ZONES[u.z][2] === type && atZone(u)); }
export function holdBonus(ctx, u) {                                            // 長期持有者：抱越久越賺
  const cls = CLASSES[ctx.S.players[u.p].cls];
  return cls.loyal ? Math.min(0.36, Math.floor(u.age / 6) * 0.04) : 0;
}
export function powerMul(ctx, u) {                                             // 幣價 → 戰力
  const c = ctx.COINS[u.coin];
  if (c.price <= 0.002) return 0.4;                                  // 歸零剩四成戰力
  const cls = CLASSES[ctx.S.players[u.p].cls];
  return clamp(c.price / u.entry, cls.lo, cls.hi);
}
export function sizeMul(ctx, u) {                                              // 戰力 → 體型（放大變化才看得出來）
  return clamp(1 + (powerMul(ctx, u) - 1) * 1.35, 0.6, 1.75);
}
export function feeOf(ctx, p) { return CLASSES[p.cls].fee * (hasUnitOn(ctx, p.i, "exchange") ? 0.5 : 1); }
export function cdMulOf(ctx, p) { return CLASSES[p.cls].cdMul * (hasUnitOn(ctx, p.i, "mountain") ? 0.75 : 1); }
export function packOf(k) { return k === "titan" ? 1 : PACK; }          // 一張卡出幾隻
export function unitCost(ctx, k, p) {                                  // 單隻：幣量 × 當下幣價 × 身份倍率
  const u = UNITS[k];
  return Math.max(1, u.qty * ctx.COINS[u.coin].price * CLASSES[p.cls].costMul);
}
export function costOf(ctx, k, p) { return Math.max(1, Math.round(unitCost(ctx, k, p) * packOf(k))); }
export function qtyOf(ctx, k, p) { return Math.round(UNITS[k].qty * CLASSES[p.cls].costMul * packOf(k)); }
export function settleValue(ctx, u) {                                          // 撤回能拿回多少
  const p = ctx.S.players[u.p];
  const v = posValue(ctx, u) * (u.hp / u.hpMax) * (1 + holdBonus(ctx, u)) * (1 - feeOf(ctx, p));
  /* 鎖倉（定存族大招）期間保本：這段時間結算至少拿回本金,虧損不算數。 */
  return (p && p.lockT > 0) ? Math.max(v, u.stake || 0) : v;
}
/* ---- 反雪球：落後補助、領先者遞減、礦區容量 ---- */
export const BASE_INCOME = 5;              // 基地每秒基礎收入
// 同一礦區疊越多礦工，後面的產出遞減（沒有人數上限，想派多少就派多少）
export const rankF = (i) => 1 / (1 + 0.25 * i);    // 第 1／2／3／4 名 = 100%／80%／67%／57%
export const DEATH_BACK = 0.35;            // 陣亡時拿回的殘值比例（讓玩家能一直出兵）
export function avgWorth(ctx) {
  const alive = ctx.S.players.filter(p => p.alive);
  if (!alive.length) return 1;
  return Math.max(80, alive.reduce((a, p) => a + netWorth(ctx, p), 0) / alive.length);
}
export function worthRatio(ctx, p) { return netWorth(ctx, p) / (ctx.S.avgW || avgWorth(ctx)); }
export function catchUpMul(ctx, p) { return clamp(2.2 - 1.5 * worthRatio(ctx, p), 1, 2); }      // 落後 → 收入最多 2×
export function leadMineMul(ctx, p) { return clamp(1.6 - 0.6 * worthRatio(ctx, p), 0.55, 1.25); } // 領先 → 產能最低 55%
export function minersIn(ctx, pi, z) { return ctx.S.units.filter(u => u.alive && u.p === pi && u.z === z && UNITS[u.k].role === "mine").length; }
export function mineRank(ctx, u) {
  const same = ctx.S.units.filter(o => o.alive && o.p === u.p && o.z === u.z && UNITS[o.k].role === "mine")
    .sort((a, b) => a.id - b.id);
  return same.findIndex(o => o.id === u.id);
}
export function mineRate(ctx, u) {
  const zi = ZINFO[ZONES[u.z][2]]; if (!zi.coin || UNITS[u.k].role !== "mine") return 0;
  const p = ctx.S.players[u.p], cls = CLASSES[p.cls];
  return zi.yield * UNITS[u.k].rate * cls.mine * (1 + holdBonus(ctx, u)) * leadMineMul(ctx, p) * rankF(mineRank(ctx, u))
    * powerMul(ctx, u);
}

/* ============================ UI 用的衍生資料(原本在 combat.js) ============================ */
export function tierOf(ctx, k) {                              // 三格強度：礦工看產能，戰鬥兵看攻擊
  const u = UNITS[k];
  if (u.role === "mine") return u.rate >= 1.2 ? 3 : (u.rate >= 0.8 ? 2 : 1);
  return u.atk >= 20 ? 3 : (u.atk >= 10 ? 2 : 1);
}
export function unitStatus(ctx, u) {
  if (u.combatT > 0) return ["交戰中", "#F2555A"];
  const zi = ZINFO[ZONES[u.z][2]];
  if (!atZone(u)) return ["移動中 → " + zi.t, "#8A9583"];
  if (UNITS[u.k].role === "mine" && zi.coin) {
    const r = mineRate(ctx, u);
    return ["挖礦 +$" + r.toFixed(1) + "/s" + (r < zi.yield * 0.8 ? "（遞減）" : ""), "#91D500"];
  }
  return ["駐守 " + zi.t, "#8A9583"];
}
export function groupTroops(ctx, mine) {                       // 同兵種＋同幣種合併成一組
  const g = new Map();
  mine.forEach(u => {
    const key = u.k + "|" + u.coin;
    let o = g.get(key);
    if (!o) { o = { k: u.k, coin: u.coin, units: [], val: 0, ret: 0, pl: 0, hp: 0, fight: 0, mining: 0, moving: 0 }; g.set(key, o); }
    o.units.push(u); o.val += posValue(ctx, u); o.ret += settleValue(ctx, u); o.hp += u.hp / u.hpMax;
    const c = ctx.COINS[u.coin];
    o.pl += (c.price <= 0.002 ? -1 : c.price / u.entry - 1);
    if (u.combatT > 0) o.fight++;
    else if (UNITS[u.k].role === "mine" && ZINFO[ZONES[u.z][2]].coin && atZone(u)) o.mining++;
    else if (!atZone(u)) o.moving++;
  });
  return [...g.values()].map(o => {
    const n = o.units.length;
    o.n = n; o.pl = o.pl / n * 100; o.hp = o.hp / n;
    o.sel = o.units.some(u => u.id === ctx.S.selU);
    return o;
  }).sort((a, b) => ORDER_ALL.indexOf(a.k) - ORDER_ALL.indexOf(b.k));
}
