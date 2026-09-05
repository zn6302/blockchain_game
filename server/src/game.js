import {
  createCoins, CLASSES, PLAYER_COLORS, ROSTER, PACK, ALLIN_MIN,
  CK, UNITS, COIN_UNITS, isLocked, lockLeft, LATE_T,
  ULTS, ULT_CD, DCA_T, DCA_EVERY, STAKE_T, ALPHA_T
} from "@noxcat/shared/constants.js";
import { ZONES, hexXY, ZINFO } from "@noxcat/shared/board.js";
import * as D from "@noxcat/shared/derived.js";

/**
 * 一個房間一個 instance。把原本 combat.js + economy.js + fx.js + lessons.js +
 * state.js 的 initPlayers 全部包進這個 factory——函式內文幾乎逐行照搬。
 *
 * `S`/`COINS`在這裡完全是「一般的 plain JS 物件」,跟原本單機版一模一樣
 * (COINS 用 bracket notation 存取、pending/trend 是普通物件、cd 是普通物件)。
 * **刻意不**讓它們直接是 Colyseus schema 的實例——因為 schema 的 MapSchema
 * 不支援 bracket notation(`COINS[k]`要改成`COINS.get(k)`),ref 型別欄位也不能
 * 直接塞一般物件進去,硬套下去要嘛得把 combat.js/derived.js 這些「client/server
 * 共用」的程式碼整套重寫成 schema-aware 語法,嘛就是等於又複製一份公式邏輯——
 * 兩者都違背「共用同一份平衡公式」的初衷。改成 ArenaRoom 每個 tick 用一個
 * 很單純的一次性同步函式,把這裡的 plain state 複製進 schema state,兩邊職責
 * 乾淨分開:這裡只管「模擬」,ArenaRoom 只管「同步 + 網路」。
 *
 * 真正需要改的地方只有:入口函式多一個 `pi`(座位)參數取代原本寫死的
 * S.players[0]/u.p===0;`toast()/sfx()`換成呼叫 emit() 廣播/發送給特定座位;
 * `S.stats`(單一)換成每人一份;AI 對手判斷從 `p.me` 換成 `p.isBot`。
 */
export function createGameInstance({ emit }) {
  const S = {
    t: 180, running: false, units: [], uid: 0, players: [],
    evtT: 10, warn: null, pending: null, trend: null, hint: "", avgW: 900,
    unlocked: false,            // 前 60 秒只能挖礦,時間到才解鎖戰鬥兵
  };
  const COINS = createCoins();
  const ctx = { S, COINS };

  // ---- 綁死 ctx 的共用公式(跟 client 端 state.js 的寫法對稱) ----
  const money = D.money, clamp = D.clamp;
  const posValue = (u) => D.posValue(ctx, u);
  const netWorth = (p) => D.netWorth(ctx, p);
  const powerMul = (u) => D.powerMul(ctx, u);
  const cdMulOf = (p) => D.cdMulOf(ctx, p);
  const packOf = D.packOf;
  const costOf = (k, p) => D.costOf(ctx, k, p);
  const settleValue = (u) => D.settleValue(ctx, u);
  const BASE_INCOME = D.BASE_INCOME, DEATH_BACK = D.DEATH_BACK;
  const avgWorth = () => D.avgWorth(ctx);
  const catchUpMul = (p) => D.catchUpMul(ctx, p);
  const minersIn = (pi, z) => D.minersIn(ctx, pi, z);
  const mineRate = (u) => D.mineRate(ctx, u);

  function priceImpact(coin, usd) {
    const c = COINS[coin]; if (c.price <= 0.002) return;
    c.price = Math.max(0.002, c.price * (1 + clamp(usd / 24000, -0.05, 0.05)));
  }

  // ---- 每位玩家的伺服器內部帳本(不進 schema,client 不需要) ----
  let priv = [];
  function freshStats() {
    return {
      buys: 0, invested: 0, sells: 0, realized: 0, best: null, worst: null, holdSum: 0, holdN: 0,
      deaths: 0, deathLoss: 0, allin: 0, allinPL: null, ult: null, ultN: 0,
      spend: { NOX: 0, CATN: 0, MEOW: 0 }
    };
  }

  /**
   * seats: [{cls, isBot, name}, ...] 長度固定 4,index 就是座位號。
   */
  function initPlayers(seats) {
    S.units = [];
    S.uid = 0;
    S.t = 180; S.running = true;
    S.evtT = 10; S.warn = null; S.pending = null; S.trend = null; S.hint = ""; S.avgW = 900;
    S.unlocked = false;
    S.players = seats.map((seat, i) => ({
      i, isBot: !!seat.isBot, name: seat.name || (seat.isBot ? `電腦 ${i + 1}` : "玩家"),
      cls: seat.cls, cash: CLASSES[seat.cls].cash, start: CLASSES[seat.cls].cash,
      alive: true, cd: {}, allin: false, reliefT: 4, incT: 1, aiNext: 1.4 + i * 0.6,
      /* 大招：ultCd 冷卻秒數、lockT 鎖倉剩餘秒數、dca 定期定額進行中的計時器。
         這三個都是「每人一份」——原型是單機版所以寫成全域的 S.lock/S.dca,
         多人版任何一個人放招都不能影響到別人。 */
      ultCd: 0, lockT: 0, dca: null,
    }));
    priv = S.players.map(p => ({ stats: freshStats(), tut: p.isBot ? null : freshTut() }));
  }

  function log(txt) { /* server 端只印 console,UI 沒有畫面在顯示這個 */ }

  /* ---- 新手教學 ----------------------------------------------------------
     單機原型是一條 setTimeout 鏈(S.tut),多人版不能這樣寫:每個座位的進度
     是各自的,而且房間可能在提示送出前就結束,殘留的 timer 會對著已經沒人的
     座位發訊息。改成每人一個小佇列,計時掛在 step() 上,房間停了就一起停。
     bot 座位的 tut 是 null,整條鏈自然跳過。 */
  function freshTut() { return { step: 0, sold: false, q: [] }; }
  function tutAt(pi, delay, fn) {
    const t = priv[pi] && priv[pi].tut;
    if (t) t.q.push({ t: delay, fn });
  }
  function tickTut(dt) {
    S.players.forEach(p => {
      const t = priv[p.i] && priv[p.i].tut;
      if (!t || !t.q.length) return;
      t.q = t.q.filter(item => {
        item.t -= dt;
        if (item.t > 0) return true;
        item.fn();
        return false;
      });
    });
  }
  /* 開局第一句。由 ArenaRoom 在 phase 切成 playing 之後才呼叫,
     早一步送出的話 client 還停在大廳畫面,提示會被切場景蓋掉。 */
  function startTutorial() {
    S.players.forEach(p => {
      if (priv[p.i] && priv[p.i].tut)
        toast("按下面第一隻 <b>礦工</b> — 這就是花 Cash 買 NOXCAT。", "warn", 5000, p.i);
    });
  }

  // ---- 特效:視覺上是共用同一張地圖,所以一律 broadcast,不分玩家。
  // 戰鬥密集時每秒會有幾十個 fx/sfx 事件,先攢著,由呼叫端(ArenaRoom)決定多久
  // flushEvents() 一次,合併成一個訊息送出去,不要每個事件各自發一次網路封包。
  let fxBuf = [], sfxBuf = [];
  function fxShot(a, b, col) { fxBuf.push({ k: "shot", x1: a.x, y1: a.y - 8, x2: b.x, y2: b.y - 8, c: col }); }
  function fxHit(x, y, col) { fxBuf.push({ k: "hit", x, y: y - 8, c: col }); }
  /* 傷害數字是廣播出去的,伺服器不知道看的人是誰,所以只送「被打的是第幾號座位」,
     紅字(我被打)還是綠字(我打到人)由每個 client 自己比對。原本這裡寫死 mine:true,
     結果每個人看到的每一發都是紅色的「-N」,連自己在打對手都像在挨打。
     v 可以是 0——鎖倉擋下來的那一發,客戶端會畫成一個青色的 0。 */
  function fxDmg(x, y, v, pi) { fxBuf.push({ k: "dmg", x, y: y - 16, v: Math.max(0, Math.round(v)), p: pi }); }
  function fxKill(x, y, col) { fxBuf.push({ k: "kill", x, y: y - 8, c: col }); }
  function fxCoin(x, y, txt, col) { fxBuf.push({ k: "coin", x: x + (Math.random() * 10 - 5), y: y - 14, txt, c: col }); }
  /* 大招的發動演出。跟其他 fx 一樣廣播給全場——對手在鎖倉、誰把家當全押成巨獸,
     這是所有人都該看得見的事,藏起來只會讓場面變得莫名其妙。u 是招式代號(順便
     借用來標 dca 每一拍的小脈衝),client 靠它決定畫哪一套;存活時間照舊由 client 補。 */
  function fxUlt(u, x, y, col, pi) { fxBuf.push({ k: "ult", u, x, y, c: col, p: pi }); }
  function baseXY(pi) {
    const b = ZONES.findIndex(z => z[2] === "base" && z[3] === pi);
    return b < 0 ? { x: 0, y: 0 } : hexXY(ZONES[b][0], ZONES[b][1]);
  }
  function sfx(kind, vol) { sfxBuf.push({ kind, vol }); }
  function toast(msg, kind, ms, targetPi) { emit("toast", { msg, kind, ms }, targetPi); }
  function flushEvents() {
    if (fxBuf.length) { emit("fx", fxBuf); fxBuf = []; }
    if (sfxBuf.length) { emit("sfx", sfxBuf); sfxBuf = []; }
  }

  /* ============================ 市場 ============================ */
  /* 全場只有一種幣，所有新聞都打在 NOX 上：漲跌一定跟你有關，
     不會出現「這則新聞跟我持有的幣無關」這種需要先判斷幣種的情況。 */
  const EVENTS = [
    { c: "NOX", f: 1.85, w: "網紅在喊 NOXCAT", t: "迷因狂熱，<b>NOXCAT 噴出</b>" },
    { c: "NOX", f: 0.55, w: "早期大戶準備解鎖", t: "解鎖拋壓，<b>NOXCAT 下殺</b>" },
    { c: "NOX", f: 1.55, w: "有交易所要上架 NOXCAT", t: "上架消息成真，<b>NOXCAT 大漲</b>" },
    { c: "NOX", f: 0.62, w: "有人在傳 NOXCAT 是騙局", t: "恐慌拋售，<b>NOXCAT 崩跌</b>" },
    { c: "NOX", f: 1.40, w: "NOXCAT 宣布要做新應用", t: "新應用發表，<b>NOXCAT 走高</b>" },
    { c: "NOX", f: 0.72, w: "礦工正在大量增產", t: "供給暴增，<b>NOXCAT 回落</b>" }
  ];
  const TREND_T = 9;

  function tickPrices(dt) {
    dt = dt || 0.6;
    CK.forEach(k => {
      const c = COINS[k];
      if (c.price <= 0.002) { c.hist.push(0); c.hist.shift(); return; }
      let drift = (Math.random() - 0.5) * c.vol * 2;
      if (S.trend && S.trend.c === k) drift += S.trend.rate * dt;
      c.price = Math.max(0.002, c.price * (1 + drift));
      /* 不做抽乾歸零:全場只有一種幣,把它歸零等於整局同時結束,
         沒有「還好我沒押那支」的對照，只是單純懲罰所有人。 */
      c.hist.push(c.price); c.hist.shift();
    });
    updateHint();
  }

  function marketEvents(dt) {
    if (S.trend) {
      S.trend.t -= dt;
      if (S.trend.t <= 0) { S.trend = null; S.evtT = 5 + Math.random() * 4; }
      return;
    }
    const lead = 12; // 伺服器端不知道「誰是 insider」該提早看到——client 自己決定何時把 pending 顯示出來
    S.evtT -= dt;
    if (S.evtT <= lead && S.evtT > 0 && !S.warn && S.pending) {
      S.warn = 1; sfx("warn", 1);
    }
    if (S.evtT <= 0) {
      if (S.pending) {
        const e = S.pending;
        S.trend = { c: e.c, rate: (Math.pow(e.f, 1 / TREND_T) - 1), t: TREND_T, t2: e.t.replace(/<\/?b>/g, "") };
        S.pending = null; S.warn = null;
      } else {
        S.pending = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        S.evtT = 7 + Math.random() * 5;
      }
    }
  }

  function setHint(h) {
    if (h && h !== S.hint) toast(h, "warn", 4200);
    S.hint = h;
  }
  function updateHint() {
    const n = COINS.NOX, h = n.hist, r = h[h.length - 10] ? n.price / h[h.length - 10] : 1;
    if (n.price <= 0.002) setHint("NOXCAT 歸零：部隊剩一半戰力，結算已經拿不回錢，讓牠們去換掉對手的礦工。");
    else if (r > 1.15) setHint("⚠ NOXCAT 短線過熱 — 現在結算可以把獲利鎖住。");
    else if (r < 0.87) setHint("⚠ NOXCAT 下跌中 — 貓咪變弱了，這時候召喚反而比較便宜。");
    else setHint("");
  }

  /* ============================ 操作：召喚＝買入 ============================ */
  function summon(pi, k) {
    if (k === "titan") return useUlt(pi);            // 巨獸只從梭哈青年的大招出場
    const p = S.players[pi], u = UNITS[k], cost = costOf(k, p);
    if (!p || !p.alive || (p.cd[k] || 0) > 0 || p.cash < cost) return;
    if (isLocked(k, S.t)) {
      toast(`🔒 <b>${u.n}</b> 還沒解鎖 — 前 60 秒先挖礦攢錢，<b>${lockLeft(S.t)} 秒</b>後開打`, "warn", 2600, pi);
      return;
    }
    if (COINS[u.coin].price <= 0.002) {
      toast(`⚠ <b>${u.coin}</b> 已經歸零，買不回來了 — ${COIN_UNITS[u.coin]} 這局不能再召喚`, "bad", 4200, pi);
      return;
    }
    /* 玩家不選格子(連傘兵的空降點也不選),一律交給 defaultTarget 自動找,少一層決策。 */
    const target = defaultTarget(pi, k);
    p.cash -= cost;
    const st = priv[pi].stats;
    st.buys++; st.invested += cost; st.spend[u.coin] += cost;
    p.cd[k] = u.cd * cdMulOf(p);
    const each = cost / packOf(k);
    for (let i = 0; i < packOf(k); i++) spawn(pi, k, target, false, { coin: u.coin, stake: each });
    priceImpact(u.coin, cost);
    sfx("buy", 1);
    const tut = priv[pi].tut;
    if (tut && tut.step === 0) {
      tut.step = 1;
      tutAt(pi, 2.6, () =>
        toast("牠們會自己去挖礦。左下角是<b>幣價</b> — 幣漲你的貓變強變大，幣跌就縮水。", "warn", 5200, pi));
      /* 已經自己按過結算的人就不用再教這一句了 */
      tutAt(pi, 11, () => {
        if (!tut.sold)
          toast("想把賺到的鎖回 Cash，就點右邊<b>我的部隊</b>下面的「全部結算」。", "warn", 5200, pi);
      });
      tutAt(pi, 20, () => {
        const me = S.players[pi], ult = me && ULTS[me.cls];
        if (S.running && me && me.alive && ult && !(me.ultCd > 0))
          toast(`召喚列右邊那顆是你的大招 <b>${ult.n}</b> — ${ult.d}。<b>想用就點它</b>，每 ${ULT_CD} 秒可以放一次。`, "warn", 6000, pi);
      });
    }
  }
  /* ALL-IN 現在是梭哈青年的大招,所以受 60 秒冷卻管、不再是「每場一次」。
     bot 沒有大招,還是照舊用 p.allin 那條一次性的路。 */
  function allIn(pi, k) {
    const p = S.players[pi], u = UNITS[k || "titan"];
    if (!p || p.cash < ALLIN_MIN || !p.alive) return;
    if (isLocked("titan", S.t)) {
      toast(`🔒 <b>巨獸</b>還沒解鎖 — <b>${lockLeft(S.t)} 秒</b>後開打`, "warn", 2600, pi); return;
    }
    if (COINS[u.coin].price <= 0.002) {
      toast(`⚠ <b>${u.coin}</b> 已經歸零，All-in 沒有意義`, "bad", 4200, pi); return;
    }
    const stake = p.cash, target = defaultTarget(pi, "soldier");
    const st = priv[pi].stats;
    st.allin = stake; st.ult = "degen"; st.ultN++;
    toast(`<b>ALL-IN</b>：${p.name} 把 ${money(stake)} 全押 ${u.coin}，巨獸出場`, "warn", 3600);
    p.cash = 0; p.allin = true; p.ultCd = ULT_CD;
    spawn(pi, "titan", target, false, { coin: u.coin, stake });
    const b = baseXY(pi);
    fxUlt("degen", b.x, b.y, ULTS.degen.hex, pi);
    sfx("ult", 1); sfx("kill", 1);
    priceImpact(u.coin, stake * 1.6);
  }

  /* ============================ 操作：大招 ============================ */
  /* 一個身份一招,冷卻 60 秒。梭哈青年的招就是 ALL-IN(所以巨獸只有他召得出來),
     其餘三招都是把一個投資觀念做成 12～24 秒的場上效果,賽後 lessons 再翻成名詞。 */
  function useUlt(pi) {
    const p = S.players[pi], ult = p && ULTS[p.cls];
    if (!p || !p.alive || !ult) return;
    if (p.ultCd > 0) {
      toast(`大招冷卻中 — 還要 <b>${Math.ceil(p.ultCd)} 秒</b>`, "warn", 2200, pi); return;
    }
    if (p.cls === "degen" && isLocked("titan", S.t)) {
      toast(`🔒 巨獸還沒解鎖 — <b>${lockLeft(S.t)} 秒</b>後開打`, "warn", 2600, pi); return;
    }
    if (p.cash < ult.min) {
      toast(`還差 <b>${money(ult.min - p.cash)}</b> 才發得動 <b>${ult.n}</b>`, "warn", 2600, pi); return;
    }
    /* ALL-IN 自己會扣 cash / 設冷卻 / 記 stats,所以直接轉過去就好。 */
    if (p.cls === "degen") return allIn(pi, "titan");

    p.ultCd = ULT_CD;
    const st = priv[pi].stats;
    st.ult = p.cls; st.ultN++;
    /* 三招的規則各不相同,但「發動」這件事本身是同一個動作:從自己的基地放出去。
       畫成什麼樣子是 client 的事,伺服器只說「誰、在哪裡、放了哪一招」。 */
    const b = baseXY(pi);
    fxUlt(p.cls, b.x, b.y, ULTS[p.cls].hex, pi);
    sfx("ult", 1);
    if (p.cls === "office") {
      p.dca = { t: DCA_T, acc: DCA_EVERY - 0.1 };
      toast(`💵 <b>定期定額</b>啟動：接下來 ${DCA_T} 秒每 ${DCA_EVERY} 秒自動買一隻礦工，不看幣價`, "warn", 4200, pi);
    } else if (p.cls === "saver") {
      p.lockT = STAKE_T;
      toast(`🔒 <b>鎖倉</b> ${STAKE_T} 秒：你的貓不會受傷，現在結算保證不虧本`, "warn", 4200, pi);
    } else if (p.cls === "insider") {
      /* 內線消息是「把下一則新聞提前告訴你,而且延後發動」——所以 pending/evtT 是
         共用的市場狀態,別人也會被影響。這是刻意的:資訊優勢的價值來自你比別人
         早知道,不是來自別人看不到那則新聞。 */
      if (!S.pending) S.pending = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      S.trend = null; S.evtT = ALPHA_T; S.warn = 1;
      toast(`🔮 <b>內線消息</b>：${S.pending.t} — <b>${ALPHA_T} 秒後</b>才發動，你有時間先動`, "warn", 6000, pi);
    }
  }

  /* ============================ 操作：結算＝賣出 ============================ */
  function settle(u, quiet) {
    if (!u || !u.alive) return 0;
    const p = S.players[u.p], got = settleValue(u);
    p.cash += got; u.alive = false;
    fxKill(u.x, u.y, "#F2F7EE"); sfx("sell", 1);
    priceImpact(u.coin, -posValue(u));
    if (priv[u.p].tut) priv[u.p].tut.sold = true;
    const st = priv[u.p].stats, pct = got / Math.max(1, u.stake) - 1;
    st.sells++; st.realized += got - u.stake; st.holdSum += u.age; st.holdN++;
    const rec = { k: u.k, coin: u.coin, entry: u.entry, exit: COINS[u.coin].price, pct, pl: got - u.stake };
    if (!st.best || pct > st.best.pct) st.best = rec;
    if (!st.worst || pct < st.worst.pct) st.worst = rec;
    if (u.k === "titan") st.allinPL = got - u.stake;
    return got;
  }
  function settleAll(pi) {
    const mine = S.units.filter(u => u.alive && u.p === pi);
    /* 按了沒反應最難懂,寧可回一句話說明為什麼沒事發生 */
    if (!mine.length) {
      toast("場上沒有你的貓，沒有東西可以賣。先按下面的貓咪召喚。", "warn", 3600, pi); return;
    }
    mine.forEach(u => settle(u, true));
  }
  function settleGroup(pi, k, coin) {
    S.units.filter(u => u.alive && u.p === pi && u.k === k && u.coin === coin).forEach(u => settle(u, true));
  }
  function settleOneById(pi, unitId) {
    const u = unitId == null ? null : S.units.find(x => x.id === unitId && x.alive && x.p === pi);
    if (!u) {
      toast("要先選一隻 — 點地圖上你的貓，或點<b>我的部隊</b>那一列（每列右邊的「結」可以直接賣掉整組）", "warn", 4200, pi);
      return;
    }
    settle(u, false);
  }

  function leaderIdx() {
    let best = -1, bw = -1;
    S.players.forEach(p => { if (p.alive) { const w = netWorth(p); if (w > bw) { bw = w; best = p.i; } } });
    return best;
  }
  function defaultTarget(pi, k) {
    const role = UNITS[k].role;
    if (role === "mine") {
      const mines = ZONES.map((z, i) => i).filter(i => ZINFO[ZONES[i][2]].coin);
      mines.sort((a, b) => minersIn(pi, a) - minersIn(pi, b));
      const few = mines.filter(i => minersIn(pi, i) === minersIn(pi, mines[0]));
      return few[Math.floor(Math.random() * few.length)];
    }
    const lead = leaderIdx();
    let enemies = S.units.filter(u => u.alive && u.p !== pi && u.p === lead);
    if (!enemies.length) enemies = S.units.filter(u => u.alive && u.p !== pi);
    if (enemies.length) return enemies[Math.floor(Math.random() * enemies.length)].z;
    return 4;
  }
  function spawn(pi, k, zi, drop, o) {
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

  /* ---- 大招的計時：冷卻、鎖倉倒數，以及定期定額固定節奏自動買 ---- */
  function tickUlts(dt) {
    S.players.forEach(p => {
      if (p.ultCd > 0) p.ultCd = Math.max(0, p.ultCd - dt);
      if (p.lockT > 0) p.lockT = Math.max(0, p.lockT - dt);
      if (!p.dca) return;
      if (!p.alive) { p.dca = null; return; }
      p.dca.t -= dt; p.dca.acc += dt;
      if (p.dca.acc >= DCA_EVERY) {
        p.dca.acc = 0;
        /* 定期定額：不看幣價、也不看冷卻,固定節奏買一隻礦工。買不起就跳過這一拍
           (現實裡沒錢也是扣不到款),不會讓玩家變成負的。 */
        const cost = costOf("miner", p) / PACK;
        if (p.cash >= cost) {
          p.cash -= cost;
          const st = priv[p.i].stats;
          st.buys++; st.invested += cost; st.spend[UNITS.miner.coin] += cost;
          spawn(p.i, "miner", defaultTarget(p.i, "miner"), false, { coin: UNITS.miner.coin, stake: cost });
          priceImpact(UNITS.miner.coin, cost);
          /* 每一拍都在基地打一個小脈衝:定期定額的重點是「節奏」,
             看得到那個固定的拍子,才知道這 24 秒裡機器一直在幫你買。 */
          const b = baseXY(p.i);
          fxUlt("dca", b.x, b.y, ULTS.office.hex, p.i);
          sfx("buy", 0.6);
        }
      }
      if (p.dca.t <= 0) {
        p.dca = null;
        toast("定期定額結束 — 你在高點低點都買過了", "warn", 3000, p.i);
      }
    });
  }

  /* ============================ 模擬 ============================ */
  function step(dt) {
    S.players.forEach(p => { for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt); });
    tickUlts(dt);
    tickTut(dt);
    marketEvents(dt);
    S.avgW = avgWorth();

    /* 前 60 秒只能挖礦，時間一到廣播解鎖，不然玩家不會發現按鈕活了。 */
    if (!S.unlocked && S.t <= LATE_T) {
      S.unlocked = true;
      toast("⚔️ <b>戰鬥兵解鎖了</b> — 士兵、刺客現在可以召喚，梭哈青年的巨獸大招也開了，去搶別人的礦區", "warn", 4600);
      sfx("warn", 1);
    }

    S.players.forEach(p => {
      if (!p.alive) return;
      p.incT -= dt;
      if (p.incT > 0) return;
      p.incT = 1;
      const inc = BASE_INCOME * catchUpMul(p) * (CLASSES[p.cls].incMul || 1);
      p.cash += inc;
      if (!S.units.some(x => x.alive && x.p === p.i) && p.cash < costOf("miner", p)) {
        p.reliefT = (p.reliefT == null ? 4 : p.reliefT) - 1;
        if (p.reliefT <= 0) {
          p.reliefT = 6;
          for (let i = 0; i < PACK; i++)
            spawn(p.i, "miner", defaultTarget(p.i, "miner"), false, { coin: UNITS.miner.coin, stake: 100 / PACK });
          toast("🎁 破產保護：免費配給你 <b>礦工×3</b>（每 6 秒一次，直到你站起來）", "warn", 4200, p.i);
        }
      } else p.reliefT = 4;
      const b = ZONES.findIndex(z => z[2] === "base" && z[3] === p.i), { x, y } = hexXY(ZONES[b][0], ZONES[b][1]);
      fxCoin(x, y - 6, "+$" + inc.toFixed(1), "#4FD1C5");
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
          if (o.p === lead && u.p !== lead) pref *= 0.65;
          if (pref < best) { best = pref; tgt = o; }
        });
      }
      if (tgt && Math.hypot(tgt.x - u.x, tgt.y - u.y) < 170) {
        const tdx = tgt.x - u.x, tdy = tgt.y - u.y, td = Math.hypot(tdx, tdy);
        if (Math.abs(tdx) > 1) u.face = tdx > 0 ? 1 : -1;
        if (td > d.rng) { u.x += tdx / td * d.spd * dt; u.y += tdy / td * d.spd * dt; u.moved = 1; }
        else {
          u.atkT -= dt;
          if (u.atkT <= 0) {
            u.atkT = 0.65;
            const dmg = (u.atk || d.atk) * powerMul(u);
            const shielded = S.players[tgt.p].lockT > 0;      // 鎖倉中：那個人的貓不受傷
            if (!shielded) tgt.hp -= dmg;
            u.combatT = 1.4; tgt.combatT = 1.4; tgt.hitT = 0.2;
            fxShot(u, tgt, PLAYER_COLORS[u.p]);
            fxHit(tgt.x, tgt.y, PLAYER_COLORS[u.p]);
            fxDmg(tgt.x, tgt.y, shielded ? 0 : dmg, tgt.p);
            sfx("shot", 0.8);
            if (!shielded && tgt.hp <= 0) {
              tgt.alive = false;
              fxKill(tgt.x, tgt.y, PLAYER_COLORS[tgt.p]);
              const loot = posValue(tgt) * 0.15;
              S.players[u.p].cash += loot;
              const back = posValue(tgt) * DEATH_BACK;
              S.players[tgt.p].cash += back;
              fxCoin(tgt.x, tgt.y - 4, "+$" + back.toFixed(0) + " 賠償", "#4FD1C5");
              sfx("kill", 1);
              fxCoin(tgt.x, tgt.y - 6, "掠奪 +$" + loot.toFixed(0), "#F5A524");
              sfx("coin", 0.8);
              const dst = priv[tgt.p].stats;
              dst.deaths++; dst.deathLoss += Math.max(0, tgt.stake - back);
              if (tgt.k === "titan") dst.allinPL = back - tgt.stake;
            }
          }
        }
      } else if (dist > 18) {
        if (Math.abs(dx) > 1) u.face = dx > 0 ? 1 : -1;
        u.x += dx / dist * d.spd * dt; u.y += dy / dist * d.spd * dt; u.moved = 1;
      } else if (d.role === "mine" && zi.coin) {
        u.mineT -= dt;
        if (u.mineT <= 0) {
          u.mineT = 1;
          const p = S.players[u.p];
          const usd = mineRate(u);
          p.cash += usd;                     // 單幣玩法只有一種產出方式:挖到就換成 Cash
          u.mineFx = 0.55;
          fxCoin(u.x, u.y, "+$" + usd.toFixed(1), "#91D500");
          sfx("coin", 0.55);
        }
      }
    });
    S.units = S.units.filter(u => u.alive);

    /* ---- bot：跟原本「AI 對手」同一套邏輯，只是判斷條件換成 isBot ---- */
    S.players.forEach(p => {
      if (!p.isBot || !p.alive) return;
      p.aiNext -= dt;
      if (p.aiNext > 0) return;
      p.aiNext = 1.8 + Math.random() * 2.2;
      S.units.forEach(u => {
        if (!u.alive || u.p !== p.i) return;
        const r = COINS[u.coin].price / u.entry;
        if (r > 1.12 || u.hp / u.hpMax < 0.35 || (S.t < 12 && r > 0.98)) settle(u, true);
      });
      /* bot 也受簡化版的解鎖限制,不然前 60 秒會變成「只有電腦能打人」。 */
      const pool = ROSTER.filter(k => costOf(k, p) <= p.cash && COINS[UNITS[k].coin].price > 0.002 && !(p.cd[k] > 0) && !isLocked(k, S.t));
      if (pool.length) {
        const wts = pool.map(k => { const c = COINS[UNITS[k].coin]; return Math.max(0.2, c.price / c.ref); });
        let s = wts.reduce((a, b) => a + b, 0) * Math.random(), pick = pool[0];
        for (let i = 0; i < pool.length; i++) { s -= wts[i]; if (s <= 0) { pick = pool[i]; break; } }
        const cost = costOf(pick, p), tz = defaultTarget(p.i, pick);
        p.cash -= cost; p.cd[pick] = UNITS[pick].cd * cdMulOf(p);
        for (let i = 0; i < packOf(pick); i++)
          spawn(p.i, pick, tz, false, { coin: UNITS[pick].coin, stake: cost / packOf(pick) });
        priceImpact(UNITS[pick].coin, cost * 0.6);
      }
      if (!p.allin && S.t < 45 && !isLocked("titan", S.t) && p.cash > 1200 && Math.random() < 0.35) {
        const k = Math.random() < 0.6 ? "soldier" : "guard";
        p.allin = true; const stake = p.cash; p.cash = 0;
        spawn(p.i, "titan", defaultTarget(p.i, k), false, { coin: UNITS[k].coin, stake });
        /* bot 走的是自己那條 all-in,不經過 useUlt,但落地的是同一隻巨獸——
           少了震波,玩家會覺得對面的巨獸是憑空長出來的。 */
        const b = baseXY(p.i);
        fxUlt("degen", b.x, b.y, ULTS.degen.hex, p.i);
        sfx("ult", 0.8); sfx("kill", 0.8);
      }
    });

    S.players.forEach(p => {
      if (p.alive && netWorth(p) < 40) {
        p.alive = false;
        S.units.forEach(u => { if (u.p === p.i) u.alive = false; });
      }
    });
  }

  /* ============================ 賽後分析 ============================ */
  function lessonsFor(pi) {
    const st = priv[pi].stats, me = S.players[pi];
    const open = D.posTotal(ctx, me), total = netWorth(me);
    const pctOf = (v) => Math.round(v / Math.max(1, st.invested) * 100);
    const out = [];
    if (st.best && st.best.pct > 0.02) {
      const b = st.best;
      out.push(["成本基準 · Cost Basis", "買在多少，決定你賺多少",
        `你有一隻 ${UNITS[b.k].n} 在 ${b.coin} $${b.entry.toFixed(2)} 時召喚、$${b.exit.toFixed(2)} 時結算，
         多賺了 ${Math.round(b.pct * 100)}%（${money(b.pl)}）。<b>賺賠看的是買進價和賣出價的差</b>，
         不是幣「貴不貴」——這就是所謂的成本基準。`]);
    }
    if (open > total * 0.25) {
      out.push(["未實現損益 · Unrealized P&L", "帳面上的錢，不是你的錢",
        `時間到的時候你還有 ${money(open)} 卡在場上的部隊身上。這叫<b>未實現損益</b>：
         看得到、算進總資產，但只要沒賣掉，它隨時會變。真的落袋要按結算。`]);
    }
    if (st.deaths > 0) {
      out.push(["風險資本 · Risk Capital", "投資會賠，而且賠掉的拿不回來",
        `你有 ${st.deaths} 支部隊陣亡，賠償只拿回三成，淨損 ${money(st.deathLoss)}，佔你總投入的 ${pctOf(st.deathLoss)}%。
         <b>丟進去的錢是有風險的</b>，不是放在銀行的存款。`]);
    }
    /* 「抽地毯」與「集中/分散」兩課都拿掉了：全場只有一種幣，前者不會發生，
       後者則是任何人都必然 100% 集中，講「你應該分散」等於在罵玩家沒做一件
       遊戲不允許的事。 */
    if (st.holdN >= 2) {
      const avg = st.holdSum / st.holdN;
      if (avg < 14) out.push(["手續費侵蝕 · Fee Drag", "你是短線玩家",
        `你平均只抱 ${avg.toFixed(0)} 秒就結算。頻繁進出能鎖住小獲利，
         但<b>每次買賣都要付手續費</b>，次數一多就會吃掉利潤。`]);
      else if (avg > 45) out.push(["長期持有 · HODL", "你是長抱玩家",
        `你平均抱了 ${avg.toFixed(0)} 秒。抱久了能吃到整段趨勢，
         但也要<b>忍受中間的上下震盪</b>，而且錢卡著就不能拿去做別的事。`]);
    }
    /* 大招那一課：把玩家剛剛按的那顆按鈕翻成現實裡的名詞。梭哈青年的招就是
       ALL-IN,已經有下面「部位大小」那一課在講,這裡就不重複。 */
    if (st.ult && ULTS[st.ult] && st.ult !== "degen") {
      const body = {
        office: `你按下定期定額之後，系統照固定節奏幫你買，完全不看當下貴不貴。
                 現實裡這叫<b>定期定額</b>：放棄猜高低點，用時間把成本攤平。`,
        saver: `鎖倉那 ${STAKE_T} 秒，你的貓不會受傷、結算也保證不虧本——代價是這段時間錢動不了。
                現實裡的<b>質押</b>就是這樣：把幣鎖起來換穩定收益，鎖住期間不能賣。`,
        insider: `你提前 ${ALPHA_T} 秒知道新聞要往哪走，然後才決定買或賣。這叫<b>資訊優勢</b>——
                  在真實市場裡，用未公開消息交易是<b>違法的內線交易</b>。`
      }[st.ult];
      out.push([ULTS[st.ult].term, `你按了 ${st.ultN || 1} 次的那一招`, body]);
    }
    if (st.allin > 0 && st.allinPL != null) {
      out.push(["部位大小 · Position Sizing", "重倉的代價",
        `你 All-in 了 ${money(st.allin)}，最後${st.allinPL >= 0 ? `多賺 ${money(st.allinPL)}` : `賠掉 ${money(-st.allinPL)}`}。
         <b>把全部資金押在一次判斷上</b>，賺的時候很爽，錯一次就沒有下一局了。`]);
    }
    if (!out.length) out.push(["買低賣高 · Buy Low, Sell High", "這局你幾乎沒有進出",
      "召喚就是買、結算就是賣。下一局試著在幣價漲的時候按結算，把獲利換回 Cash。"]);
    return out.slice(0, 4);
  }

  return {
    S, COINS,
    initPlayers, startTutorial, step, tickPrices, flushEvents,
    summon, useUlt, settleAll, settleGroup, settleOneById,
    lessonsFor,
    statsFor: (pi) => priv[pi].stats,
    alivePlayerCount: () => S.players.filter(p => p.alive).length,
  };
}
