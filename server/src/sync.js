import { CK } from "@noxcat/shared/constants.js";
import { CoinState, MarketEventState, TrendState, UnitState } from "./schema/GameState.js";

/**
 * 把 game.js 的 plain S/COINS 複製進 Colyseus 的 schema state。
 * 只做「同步」,不做邏輯——邏輯都在 game.js 裡跑完了。
 */
export function syncState(state, game) {
  const S = game.S, COINS = game.COINS;

  state.t = Math.max(0, S.t);
  state.running = S.running;
  state.evtT = S.evtT;
  state.hint = S.hint;

  CK.forEach(k => {
    let c = state.coins.get(k);
    if (!c) { c = new CoinState(); state.coins.set(k, c); }
    c.price = COINS[k].price;
    c.ref = COINS[k].ref;
  });

  if (S.pending) {
    if (!state.pending) state.pending = new MarketEventState();
    state.pending.c = S.pending.c;
    state.pending.f = S.pending.f;
    state.pending.w = S.pending.w;
    state.pending.t = S.pending.t;
  } else if (state.pending) {
    state.pending = undefined;
  }

  if (S.trend) {
    if (!state.trend) state.trend = new TrendState();
    state.trend.c = S.trend.c;
    state.trend.rate = S.trend.rate;
    state.trend.t = S.trend.t;
    state.trend.t2 = S.trend.t2;
  } else if (state.trend) {
    state.trend = undefined;
  }

  S.players.forEach((p, i) => {
    const sp = state.players[i];
    if (!sp) return;
    sp.cash = p.cash;
    sp.start = p.start;
    sp.alive = p.alive;
    sp.auto = p.auto;
    sp.allin = p.allin;
    sp.reliefT = p.reliefT || 0;
    const staleKeys = new Set(sp.cd.keys());
    for (const k in p.cd) { sp.cd.set(k, p.cd[k]); staleKeys.delete(k); }
    staleKeys.forEach(k => sp.cd.delete(k));
  });

  // 單位一直在生生滅滅：先把已經不在的移除,再用 id 對應既有的 schema 單位,
  // 沒有的才新建——避免每個 tick 整批重建造成 client 端閃爍/浪費頻寬。
  const liveIds = new Set(S.units.map(u => u.id));
  for (let i = state.units.length - 1; i >= 0; i--) {
    if (!liveIds.has(state.units[i].id)) state.units.splice(i, 1);
  }
  const existing = new Map();
  state.units.forEach(u => existing.set(u.id, u));
  S.units.forEach(u => {
    let su = existing.get(u.id);
    if (!su) { su = new UnitState(); state.units.push(su); existing.set(u.id, su); }
    su.id = u.id; su.p = u.p; su.k = u.k; su.coin = u.coin; su.z = u.z; su.alive = u.alive;
    su.entry = u.entry; su.qty = u.qty; su.stake = u.stake; su.atk = u.atk;
    su.hp = u.hp; su.hpMax = u.hpMax; su.x = u.x; su.y = u.y; su.face = u.face;
    su.combatT = u.combatT; su.mineFx = u.mineFx; su.hitT = u.hitT; su.moved = u.moved; su.age = u.age;
    su.atkT = u.atkT; su.mineT = u.mineT;
  });
}
