import { COINS, UNITS, CLASSES, PLAYER_COLORS, ROSTER, PACK, ALLIN_MIN, COIN_UNITS } from "./constants.js";
import { ZONES, ZINFO, hexXY } from "@noxcat/shared/board.js";
import {
  S, clamp, money, posValue, unitWorth, posTotal, netWorth, atZone, hasUnitOn,
  holdBonus, powerMul, sizeMul, feeOf, cdMulOf, packOf, unitCost, costOf, qtyOf,
  settleValue, BASE_INCOME, rankF, DEATH_BACK, avgWorth, worthRatio, catchUpMul,
  leadMineMul, minersIn, mineRank, mineRate, priceImpact
} from "./state.js";
import { log, marketEvents } from "./economy.js";
import { sfx } from "./audio.js";
import { toast } from "./toast.js";
import { fxShot, fxHit, fxDmg, fxKill, fxCoin } from "./fx.js";

/* ============================ 出兵列（強度分級，UI 用） ============================ */
export function tierOf(k) {                                   // 三格強度：礦工看產能，戰鬥兵看攻擊
  const u = UNITS[k];
  if (u.role === "mine") return u.rate >= 1.2 ? 3 : (u.rate >= 0.8 ? 2 : 1);
  return u.atk >= 20 ? 3 : (u.atk >= 10 ? 2 : 1);
}

export function flashUnit(k) {
  S.flashKey = k;
  S.flashUntil = performance.now() + 200;
}

/* ============================ 操作：召喚＝買入 ============================ */
export function summon(k) {
  if (k === "titan") return allIn("titan");
  const p = S.players[0], u = UNITS[k], cost = costOf(k, p);
  if (!p.alive || (p.cd[k] || 0) > 0 || p.cash < cost) return;
  if (COINS[u.coin].price <= 0.002) {
    toast(`⚠ <b>${u.coin}</b> 已經歸零，買不回來了 — ${COIN_UNITS[u.coin]} 這局不能再召喚`, "bad");
    return;
  }
  const drop = (k === "para");
  if (drop && S.sel == null) { log("傘兵需要先在地圖上選一個空降點", "bad"); return; }
  const target = S.sel != null ? S.sel : defaultTarget(0, k);
  p.cash -= cost;
  S.stats.buys++; S.stats.invested += cost; S.stats.spend[u.coin] += cost;
  p.cd[k] = u.cd * cdMulOf(p);
  const each = cost / packOf(k);
  for (let i = 0; i < packOf(k); i++) spawn(0, k, target, drop, { coin: u.coin, stake: each });
  priceImpact(u.coin, cost);
  flashUnit(k); sfx("buy", 1);
  log(`召喚 <b>${u.n}×${packOf(k)}</b>：買入 ${money(cost)} 的 <b>${u.coin}</b> → ${ZINFO[ZONES[target][2]].t}`);
}
export function allIn(k) {
  const p = S.players[0], u = UNITS[k];
  if (p.allin || p.cash < ALLIN_MIN || !p.alive) return;
  if (COINS[u.coin].price <= 0.002) {
    toast(`⚠ <b>${u.coin}</b> 已經歸零，All-in 沒有意義`, "bad"); return;
  }
  const stake = p.cash, target = S.sel != null ? S.sel : defaultTarget(0, "soldier");
  S.stats.allin = stake;
  toast(`<b>ALL-IN</b>：${money(stake)} 全押 ${u.coin}，巨獸出場（每場一次）`, "warn", 3600);
  p.cash = 0; p.allin = true;
  spawn(0, "titan", target, false, { coin: u.coin, stake });
  priceImpact(u.coin, stake * 1.6);
  log(`<b>ALL-IN</b>：${money(stake)} 全押 ${u.coin}，${u.coin} 巨獸出場（每場一次）`, "good");
}

/* ============================ 操作：結算＝賣出 ============================ */
export function settle(u, quiet) {
  if (!u || !u.alive) return 0;
  const p = S.players[u.p], got = settleValue(u);
  p.cash += got; u.alive = false;
  if (u.p === 0) { fxKill(u.x, u.y, "#F2F7EE"); sfx("sell", 1); }
  priceImpact(u.coin, -posValue(u));
  if (u.p === 0) {
    const st = S.stats, pct = got / Math.max(1, u.stake) - 1;
    st.sells++; st.realized += got - u.stake; st.holdSum += u.age; st.holdN++;
    const rec = { k: u.k, coin: u.coin, entry: u.entry, exit: COINS[u.coin].price, pct, pl: got - u.stake };
    if (!st.best || pct > st.best.pct) st.best = rec;
    if (!st.worst || pct < st.worst.pct) st.worst = rec;
    if (u.k === "titan") st.allinPL = got - u.stake;
  }
  if (u.p === 0 && !quiet) {
    const pl = got - u.stake;
    log(`結算 <b>${UNITS[u.k].n}</b>：賣出 ${u.coin} 取回 ${money(got)}
      （${pl >= 0 ? "+" : "−"}${money(Math.abs(pl))}）`, pl >= 0 ? "good" : "bad");
  }
  if (S.selU === u.id) S.selU = null;
  return got;
}
export function settleAll() {
  const mine = S.units.filter(u => u.alive && u.p === 0);
  if (!mine.length) return;
  let got = 0, cost = 0;
  mine.forEach(u => { cost += u.stake; got += settle(u, true); });
  const pl = got - cost;
  log(`全部結算：撤回 ${mine.length} 支部隊，取回 <b>${money(got)}</b>（${pl >= 0 ? "+" : "−"}${money(Math.abs(pl))}）`,
    pl >= 0 ? "good" : "bad");
}
export function settleGroup(k, coin) {
  const grp = S.units.filter(u => u.alive && u.p === 0 && u.k === k && u.coin === coin);
  if (!grp.length) return;
  let got = 0, cost = 0;
  grp.forEach(u => { cost += u.stake; got += settle(u, true); });
  const pl = got - cost;
  log(`結算 <b>${UNITS[k].n}×${grp.length}</b>：取回 ${money(got)}（${pl >= 0 ? "+" : "−"}${money(Math.abs(pl))}）`,
    pl >= 0 ? "good" : "bad");
  sfx("sell", 1);
}

export function leaderIdx() {
  let best = -1, bw = -1;
  S.players.forEach(p => { if (p.alive) { const w = netWorth(p); if (w > bw) { bw = w; best = p.i; } } });
  return best;
}
export function defaultTarget(pi, k) {
  const role = UNITS[k].role;
  if (role === "mine") {                                   // 優先挑人比較少的礦區
    const mines = ZONES.map((z, i) => i).filter(i => ZINFO[ZONES[i][2]].coin);
    mines.sort((a, b) => minersIn(pi, a) - minersIn(pi, b));
    const few = mines.filter(i => minersIn(pi, i) === minersIn(pi, mines[0]));
    return few[Math.floor(Math.random() * few.length)];
  }
  const lead = leaderIdx();
  let enemies = S.units.filter(u => u.alive && u.p !== pi && u.p === lead);   // 先打第一名
  if (!enemies.length) enemies = S.units.filter(u => u.alive && u.p !== pi);
  if (enemies.length) return enemies[Math.floor(Math.random() * enemies.length)].z;
  return 4;
}
export function spawn(pi, k, zi, drop, o) {
  const src = drop ? zi : ZONES.findIndex(z => z[2] === "base" && z[3] === pi);
  const { x, y } = hexXY(ZONES[src][0], ZONES[src][1]);
  const d = UNITS[k], coin = o.coin, price = COINS[coin].price, stake = o.stake;
  let hp = d.hp, atk = d.atk;
  if (k === "titan") { hp = Math.min(1800, 260 + stake * 0.55); atk = Math.min(95, 18 + stake * 0.035); }
  S.units.push({
    id: ++S.uid, p: pi, k, coin, z: zi, alive: true,
    entry: price, qty: stake / price, stake, atk, age: 0,
    hp, hpMax: hp, x: x + (Math.random() * 34 - 17), y: y + (Math.random() * 26 - 13),
    atkT: 0, mineT: 1, hitT: 0, combatT: 0, mineFx: 0, moved: 1, face: (pi === 1 || pi === 2) ? -1 : 1
  });
}

/* ============================ 我的部隊：分組（UI 用的衍生資料） ============================ */
export function unitStatus(u) {
  if (u.combatT > 0) return ["交戰中", "#F2555A"];
  const zi = ZINFO[ZONES[u.z][2]];
  if (!atZone(u)) return ["移動中 → " + zi.t, "#8A9583"];
  if (UNITS[u.k].role === "mine" && zi.coin) {
    const r = mineRate(u);
    return ["挖礦 +$" + r.toFixed(1) + "/s" + (r < zi.yield * 0.8 ? "（遞減）" : ""), "#A3E635"];
  }
  return ["駐守 " + zi.t, "#8A9583"];
}
export function groupTroops(mine) {                       // 同兵種＋同幣種合併成一組
  const g = new Map();
  mine.forEach(u => {
    const key = u.k + "|" + u.coin;
    let o = g.get(key);
    if (!o) { o = { k: u.k, coin: u.coin, units: [], val: 0, ret: 0, pl: 0, hp: 0, fight: 0, mining: 0, moving: 0 }; g.set(key, o); }
    o.units.push(u); o.val += posValue(u); o.ret += settleValue(u); o.hp += u.hp / u.hpMax;
    const c = COINS[u.coin];
    o.pl += (c.price <= 0.002 ? -1 : c.price / u.entry - 1);
    if (u.combatT > 0) o.fight++;
    else if (UNITS[u.k].role === "mine" && ZINFO[ZONES[u.z][2]].coin && atZone(u)) o.mining++;
    else if (!atZone(u)) o.moving++;
  });
  return [...g.values()].map(o => {
    const n = o.units.length;
    o.n = n; o.pl = o.pl / n * 100; o.hp = o.hp / n;
    o.sel = o.units.some(u => u.id === S.selU);
    return o;
  }).sort((a, b) => ROSTER.indexOf(a.k) - ROSTER.indexOf(b.k));
}

/* ============================ 模擬 ============================ */
export function step(dt) {
  S.players.forEach(p => { for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt); });
  marketEvents(dt);

  S.avgW = avgWorth();
  S.fx.forEach(f => { f.t -= dt; });
  if (S.fx.length) S.fx = S.fx.filter(f => f.t > 0);

  // 基地保底收入（落後越多給越多）
  S.players.forEach(p => {
    if (!p.alive) return;
    p.incT -= dt;
    if (p.incT > 0) return;
    p.incT = 1;
    const inc = BASE_INCOME * catchUpMul(p) * (CLASSES[p.cls].incMul || 1);
    p.cash += inc;
    // 破產保護：場上沒兵又買不起礦工時，每 10 秒配一名免費礦工
    if (!S.units.some(x => x.alive && x.p === p.i) && p.cash < costOf("miner", p)) {
      p.reliefT = (p.reliefT == null ? 4 : p.reliefT) - 1;
      if (p.reliefT <= 0) {
        p.reliefT = 6;
        for (let i = 0; i < PACK; i++)
          spawn(p.i, "miner", defaultTarget(p.i, "miner"), false, { coin: "CATN", stake: 100 / PACK });
        if (p.me) toast("🎁 破產保護：免費配給你 <b>礦工×3</b>（每 6 秒一次，直到你站起來）", "warn");
      }
    } else p.reliefT = 4;
    if (p.me) {
      S.baseInc = inc;
      const b = ZONES.findIndex(z => z[2] === "base" && z[3] === 0), { x, y } = hexXY(ZONES[b][0], ZONES[b][1]);
      fxCoin(x, y - 6, "+$" + inc.toFixed(1), "#4FD1C5");
    }
  });

  S.units.forEach(u => {
    if (!u.alive) return;
    u.age += dt;
    if (u.hitT > 0) u.hitT = Math.max(0, u.hitT - dt);
    if (u.mineFx > 0) u.mineFx = Math.max(0, u.mineFx - dt);
    if (u.moved > 0) u.moved = Math.max(0, u.moved - dt * 1.2);
    if (u.combatT > 0) u.combatT = Math.max(0, u.combatT - dt);
    const d = UNITS[u.k], z = ZONES[u.z], zi = ZINFO[z[2]];
    const { x, y } = hexXY(z[0], z[1]);
    const dx = x - u.x, dy = y - u.y, dist = Math.hypot(dx, dy);
    let tgt = null;
    if (d.role !== "mine") {
      let best = 1e9;
      const lead = leaderIdx();
      S.units.forEach(o => {
        if (!o.alive || o.p === u.p) return;
        const dd = Math.hypot(o.x - u.x, o.y - u.y);
        let pref = (d.role === "hunt" && UNITS[o.k].role === "mine") ? dd * 0.6 : dd;
        if (o.p === lead && u.p !== lead) pref *= 0.65;             // 大家先打第一名
        if (pref < best) { best = pref; tgt = o; }
      });
    }
    if (tgt && Math.hypot(tgt.x - u.x, tgt.y - u.y) < 170) {
      const tdx = tgt.x - u.x, tdy = tgt.y - u.y, td = Math.hypot(tdx, tdy);
      if (Math.abs(tdx) > 1) u.face = tdx > 0 ? 1 : -1;                 // 面向目標
      if (td > d.rng) { u.x += tdx / td * d.spd * dt; u.y += tdy / td * d.spd * dt; u.moved = 1; }
      else {
        u.atkT -= dt;
        if (u.atkT <= 0) {
          u.atkT = 0.65;
          const dmg = (u.atk || d.atk) * powerMul(u);
          tgt.hp -= dmg;
          const near = (u.p === 0 || tgt.p === 0);
          u.combatT = 1.4; tgt.combatT = 1.4; tgt.hitT = 0.2;
          fxShot(u, tgt, PLAYER_COLORS[u.p]);
          fxHit(tgt.x, tgt.y, PLAYER_COLORS[u.p]);
          if (near) { fxDmg(tgt.x, tgt.y, dmg, tgt.p === 0); sfx("shot", 0.8); }
          if (tgt.hp <= 0) {
            tgt.alive = false;
            fxKill(tgt.x, tgt.y, PLAYER_COLORS[tgt.p]);
            const loot = posValue(tgt) * 0.15;                 // 掠奪：搶走對方部位的 15%
            S.players[u.p].cash += loot;
            const back = posValue(tgt) * DEATH_BACK;           // 陣亡賠償：自己拿回三成殘值
            S.players[tgt.p].cash += back;
            if (tgt.p === 0) { fxCoin(tgt.x, tgt.y - 4, "+$" + back.toFixed(0) + " 賠償", "#4FD1C5"); sfx("coin", 0.5); }
            if (near) sfx("kill", 1);
            if (u.p === 0) { fxCoin(tgt.x, tgt.y - 6, "掠奪 +$" + loot.toFixed(0), "#F5A524"); sfx("coin", 0.8); }
            if (tgt.id === S.selU) S.selU = null;
            if (tgt.p === 0) {
              S.stats.deaths++; S.stats.deathLoss += Math.max(0, tgt.stake - back);
              if (tgt.k === "titan") S.stats.allinPL = back - tgt.stake;
            }
            if (tgt.p === 0) log(`你的 <b>${UNITS[tgt.k].n}</b> 陣亡 — 賠償 ${money(back)}，其餘 ${money(Math.max(0, tgt.stake - back))} 蒸發`, "bad");
            else if (u.p === 0) log(`${UNITS[u.k].n} 擊殺 <b>${S.players[tgt.p].name}</b> 的 ${UNITS[tgt.k].n}`, "good");
          }
        }
      }
    } else if (dist > 18) {
      if (Math.abs(dx) > 1) u.face = dx > 0 ? 1 : -1;                    // 面向行進方向
      u.x += dx / dist * d.spd * dt; u.y += dy / dist * d.spd * dt; u.moved = 1;
    } else if (d.role === "mine" && zi.coin) {
      u.mineT -= dt;
      if (u.mineT <= 0) {
        u.mineT = 1;
        const p = S.players[u.p];
        const usd = mineRate(u);
        const hold = (p.auto !== "sell" && COINS[u.coin].price > 0.002);
        if (hold) u.qty += usd / COINS[u.coin].price; else p.cash += usd;
        u.mineFx = 0.55;
        if (p.me) {
          const c = COINS[u.coin];
          fxCoin(u.x, u.y, hold ? "+" + (usd / c.price).toFixed(2) + " " + u.coin : "+$" + usd.toFixed(1),
            hold ? c.hex : "#A3E635");
          sfx("coin", 0.55);
        }
      }
    }
  });
  S.units = S.units.filter(u => u.alive);

  /* ---- AI：也玩同一套循環 ---- */
  S.players.forEach(p => {
    if (p.me || !p.alive) return;
    p.aiNext -= dt;
    if (p.aiNext > 0) return;
    p.aiNext = 1.8 + Math.random() * 2.2;
    // 有賺就結算，快死也結算
    S.units.forEach(u => {
      if (!u.alive || u.p !== p.i) return;
      const r = COINS[u.coin].price / u.entry;
      if (r > 1.12 || u.hp / u.hpMax < 0.35 || (S.t < 12 && r > 0.98)) settle(u, true);
    });
    const pool = ROSTER.filter(k => k !== "titan" && costOf(k, p) <= p.cash && COINS[UNITS[k].coin].price > 0.002 && !(p.cd[k] > 0));
    if (pool.length) {
      // 幣價漲的兵種比較常被 AI 選
      const wts = pool.map(k => { const c = COINS[UNITS[k].coin]; return Math.max(0.2, c.price / c.ref); });
      let s = wts.reduce((a, b) => a + b, 0) * Math.random(), pick = pool[0];
      for (let i = 0; i < pool.length; i++) { s -= wts[i]; if (s <= 0) { pick = pool[i]; break; } }
      const cost = costOf(pick, p), tz = defaultTarget(p.i, pick);
      p.cash -= cost; p.cd[pick] = UNITS[pick].cd * cdMulOf(p);
      for (let i = 0; i < packOf(pick); i++)
        spawn(p.i, pick, tz, false, { coin: UNITS[pick].coin, stake: cost / packOf(pick) });
      priceImpact(UNITS[pick].coin, cost * 0.6);
    }
    if (!p.allin && S.t < 45 && p.cash > 1200 && Math.random() < 0.35) {
      const k = Math.random() < 0.6 ? "soldier" : "guard";
      p.allin = true; const stake = p.cash; p.cash = 0;
      spawn(p.i, "titan", defaultTarget(p.i, k), false, { coin: UNITS[k].coin, stake });
      log(`<b>${p.name}</b> All-in 了`, "bad");
    }
  });

  S.players.forEach(p => {
    if (p.alive && netWorth(p) < 40) {
      p.alive = false;
      S.units.forEach(u => { if (u.p === p.i) u.alive = false; });
      log(`<b>${p.name}</b> 資產歸零，出局`, p.me ? "bad" : "good");
    }
  });
}
