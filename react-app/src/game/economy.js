import { CK, COINS, CLASSES } from "./constants.js";
import { S } from "./state.js";
import { sfx } from "./audio.js";
import { toast } from "./toast.js";

/* ============================ 市場 ============================ */
/* 價格幾乎只由新聞推動：預告 → 一段 9 秒的趨勢 → 平靜。玩家能說出「因為…所以我現在買」 */
export const EVENTS = [
  { c: "MEOW", f: 2.05, w: "網紅在喊喵喵迷因幣", t: "迷因狂熱，<b>MEOW 直接翻倍</b>" },
  { c: "MEOW", f: 0.45, w: "喵喵幣早期大戶準備解鎖", t: "解鎖拋壓，<b>MEOW 腰斬</b>" },
  { c: "MEOW", f: 1.75, w: "有交易所要上架喵喵幣", t: "上架消息成真，<b>MEOW 大漲</b>" },
  { c: "MEOW", f: 0.55, w: "有人在傳喵喵幣是騙局", t: "恐慌拋售，<b>MEOW 崩跌</b>" },
  { c: "CATN", f: 1.45, w: "貓薄荷幣宣布要做新應用", t: "新應用發表，<b>貓薄荷幣走高</b>" },
  { c: "CATN", f: 0.68, w: "貓薄荷田正在大量增產", t: "供給暴增，<b>貓薄荷幣回落</b>" },
  { c: "NOX", f: 1.05, w: "市場恐慌，資金逃向 NOXCAT", t: "避險買盤，<b>NOXCAT 小漲</b>" },
  { c: "NOX", f: 0.96, w: "NOXCAT 的儲備傳出疑慮", t: "信心動搖，<b>NOXCAT 小幅波動</b>" }
];
export const TREND_T = 9;                                   // 一段行情走幾秒

export function log(txt, kind) {                      // 事件視窗已移除，只保留最近紀錄
  S.logs.unshift({ t: S.t, txt, kind });
  if (S.logs.length > 40) S.logs.pop();
}

export function tickPrices(dt) {
  dt = dt || 0.6;
  CK.forEach(k => {
    const c = COINS[k];
    if (c.price <= 0.002) { c.hist.push(0); c.hist.shift(); return; }
    let drift = (Math.random() - 0.5) * c.vol * 2;         // 平時只有很小的雜訊
    if (S.trend && S.trend.c === k) drift += S.trend.rate * dt;   // 新聞造成的趨勢
    c.price = Math.max(0.002, c.price * (1 + drift));
    if (k === "MEOW" && S.t < 120 && Math.random() < 0.0009) {
      S.stats.rugged = true;
      S.units.forEach(u => { if (u.alive && u.p === 0 && u.coin === "MEOW") S.stats.rugLoss += u.qty * COINS[u.coin].price; });
      c.price = 0.002;
      toast("⚠ <b>喵喵迷因幣被抽乾了</b>：MEOW 部隊只剩 50% 戰力，牠們身上的錢幾乎歸零，而且買不回來了。", "bad", 7000);
      log("<b>喵喵迷因幣歸零</b>：所有 MEOW 部隊虛弱化", "bad");
    }
    c.hist.push(c.price); c.hist.shift();
  });
  updateHint();
}

export function marketEvents(dt) {
  if (S.trend) {                                     // 行情進行中
    S.trend.t -= dt;
    if (S.trend.t <= 0) { S.trend = null; S.evtT = 5 + Math.random() * 4; }
    return;
  }
  const lead = (S.cls && CLASSES[S.cls].lead) || 6;
  S.evtT -= dt;
  if (S.evtT <= lead && S.evtT > 0 && !S.warn && S.pending) {
    S.warn = 1; sfx("warn", 1);
  }
  if (S.evtT <= 0) {
    if (S.pending) {
      const e = S.pending;
      S.trend = { c: e.c, rate: (Math.pow(e.f, 1 / TREND_T) - 1), t: TREND_T, t2: e.t.replace(/<\/?b>/g, "") };
      log(e.t, e.f >= 1 ? "good" : "bad");
      S.pending = null; S.warn = null;
    } else {
      S.pending = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      S.evtT = 7 + Math.random() * 5;
    }
  }
}

export function setHint(h) {
  if (h && h !== S.hint) toast(h, "warn", 4200);
  S.hint = h;
}

export function updateHint() {
  const n = COINS.MEOW, h = n.hist, r = h[h.length - 10] ? n.price / h[h.length - 10] : 1;
  if (n.price <= 0.002) setHint("喵喵幣歸零：MEOW 部隊剩一半戰力，結算已經拿不回錢，讓牠們去換掉對手的礦工。");
  else if (r > 1.15) setHint("⚠ 喵喵幣短線過熱 — 現在結算 MEOW 部隊可以把獲利鎖住。");
  else if (r < 0.87) setHint("⚠ 喵喵幣下跌中 — MEOW 部隊變弱，改召 NOXCAT 部隊守礦區。");
  else setHint("");
}
