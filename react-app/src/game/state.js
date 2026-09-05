import { COINS } from "./constants.js";
import * as derived from "@noxcat/shared/derived.js";

/* ============================ 狀態 ============================ */
/* S 是這個分頁的單例,鏡射伺服器(Colyseus room)狀態的本地副本——
   形狀跟伺服器的 GameState/PlayerState/UnitState 對應,由 engine.js 收到
   room.onStateChange 時原地寫入,而不是自己跑模擬。 */
export const S = {
  phase: "connecting",              // "connecting" | "lobby" | "playing" | "ended"
  connected: false, connectError: null,
  mySessionId: null, myIndex: null,
  t: 180, running: false, sel: null, selU: null,
  units: [], players: [], over: false,
  evtT: 10, pending: null, trend: null, hint: "", fx: [],
  lobbyDeadline: 0,
  flashKey: null, flashUntil: 0,
  stats: null, lessonsCache: null,
};

const ctx = { S, COINS };

/* 把 shared/derived.js 的 ctx-bound 函式綁回原本零參數(除了 unit/player 本身)的呼叫方式,
   讓元件們完全不用改呼叫端。 */
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

/* UI 用的衍生資料(原本在 combat.js,現在跟公式一樣共用 shared/derived.js) */
export const tierOf = derived.tierOf;
export const unitStatus = (u) => derived.unitStatus(ctx, u);
export const groupTroops = (mine) => derived.groupTroops(ctx, mine);
