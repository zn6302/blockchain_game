import { CLASSES, PLAYER_COLORS, AI_NAMES } from "./constants.js";
import { COINS } from "./constants.js";
import * as derived from "@noxcat/shared/derived.js";

/* ============================ 狀態 ============================ */
/* 目前還是單機版:S 是這個分頁的單例,combat.js/economy.js 直接讀寫它。
   之後接上 Colyseus 後,S 的角色會變成「鏡射伺服器狀態的本地副本」,
   形狀不變,只是不再由本地模擬寫入。 */
export const S = {
  t: 180, running: false, cls: null, sel: null, selU: null,
  units: [], uid: 0, players: [], over: false,
  evtT: 10, warn: null, pending: null, trend: null, hint: "", fx: [], hot: "", logs: [], avgW: 900, baseInc: 5,
  broke: false, flashKey: null, flashUntil: 0,
  stats: {
    buys: 0, invested: 0, sells: 0, realized: 0, best: null, worst: null, holdSum: 0, holdN: 0,
    deaths: 0, deathLoss: 0, rugLoss: 0, rugged: false, allin: 0, allinPL: null, spend: { NOX: 0, CATN: 0, MEOW: 0 }
  }
};

const ctx = { S, COINS };

/* 把 shared/derived.js 的 ctx-bound 函式綁回原本零參數(除了 unit/player 本身)的呼叫方式,
   讓其他檔案(combat.js/economy.js/元件們)完全不用改呼叫端。 */
export const clamp = derived.clamp;
export const money = derived.money;
export const posValue = (u) => derived.posValue(ctx, u);
export const unitWorth = (u) => derived.unitWorth(ctx, u);
export const posTotal = (p) => derived.posTotal(ctx, p);
export const netWorth = (p) => derived.netWorth(ctx, p);
export const atZone = derived.atZone;
export const hasUnitOn = (pi, type) => derived.hasUnitOn(ctx, pi, type);
export const holdBonus = (u) => derived.holdBonus(ctx, u);
export const powerMul = (u) => derived.powerMul(ctx, u);
export const sizeMul = (u) => derived.sizeMul(ctx, u);
export const feeOf = (p) => derived.feeOf(ctx, p);
export const cdMulOf = (p) => derived.cdMulOf(ctx, p);
export const packOf = derived.packOf;
export const unitCost = (k, p) => derived.unitCost(ctx, k, p);
export const costOf = (k, p) => derived.costOf(ctx, k, p);
export const qtyOf = derived.qtyOf;
export const settleValue = (u) => derived.settleValue(ctx, u);
export const BASE_INCOME = derived.BASE_INCOME;
export const rankF = derived.rankF;
export const DEATH_BACK = derived.DEATH_BACK;
export const avgWorth = () => derived.avgWorth(ctx);
export const worthRatio = (p) => derived.worthRatio(ctx, p);
export const catchUpMul = (p) => derived.catchUpMul(ctx, p);
export const leadMineMul = (p) => derived.leadMineMul(ctx, p);
export const minersIn = (pi, z) => derived.minersIn(ctx, pi, z);
export const mineRank = (u) => derived.mineRank(ctx, u);
export const mineRate = (u) => derived.mineRate(ctx, u);

export function priceImpact(coin, usd) {                                   // 大額進出推動幣價（滑價）
  const c = COINS[coin]; if (c.price <= 0.002) return;
  c.price = Math.max(0.002, c.price * (1 + clamp(usd / 24000, -0.05, 0.05)));
}

export function initPlayers(clsKey) {
  S.players = [0, 1, 2, 3].map(i => ({
    i, me: i === 0, name: i === 0 ? "你" : AI_NAMES[i - 1], color: PLAYER_COLORS[i],
    cls: i === 0 ? clsKey : ["office", "saver", "degen", "insider"].filter(c => c !== clsKey)[i - 1],
    cash: CLASSES[i === 0 ? clsKey : ["office", "saver", "degen", "insider"][i % 4]].cash,
    start: CLASSES[i === 0 ? clsKey : ["office", "saver", "degen", "insider"][i % 4]].cash,
    alive: true, cd: {}, aiNext: 1.4 + i * 0.6, incT: 1,
    auto: "sell", allin: false
  }));
}
