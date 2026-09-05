import { Client } from "@colyseus/sdk";
import { S, resetRoomState, setMode } from "./state.js";
import { COINS } from "./constants.js";
import { toast } from "./toast.js";
import { SFX, sfxInit, sfx } from "./audio.js";

/* 伺服器只送「這個事件發生了」的資料(k/x/y/...),沒有帶存活時間——
   存活時間是純視覺概念,原本活在 combat.js 的 fx.js 裡,現在搬到這裡, "接到就補上"。 */
const FX_LIFE = { shot: 0.13, hit: 0.24, dmg: 0.85, kill: 0.5, coin: 1.05 };

function wsEndpoint() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.hostname}:2567`;
}

/* ---------------- 房號配對 ----------------
   房號就是伺服器 filterBy(["code"]) 用的鍵:同一個 code 才會配到同一間房。 */
/* 隨機配對共用的公共房。兩種模式各一間,不然快速配對會把想玩簡化版的人
   丟進完整版的房(房間的模式是建房時就定死的)。抽號從 1000 起,不會撞到。 */
const PUBLIC_CODE = { full: "0000", simple: "0001" };

export function makeRoomCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}
export function normalizeCode(raw) {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 4);
}
export function isPublicCode(code) {
  return Object.values(PUBLIC_CODE).includes(code);
}

/* Colyseus 找不到符合 code 的房就丟 521;其餘照伺服器訊息顯示(房間已滿/已開始)。 */
function friendlyError(err, code) {
  if (err && err.code === 521) return `找不到房號 ${code}，可能號碼打錯、房間已滿或那場已經開始了`;
  const msg = String((err && err.message) || err || "");
  return msg || "連線失敗";
}

/**
 * 遊戲引擎(連線版):不再自己跑模擬,改成連 Colyseus room,把收到的
 * schema state 鏡射進本地單例 S/COINS(形狀不變,元件完全不用管資料是哪來的),
 * 動作方法(summon/settleOne/...)改成送訊息給伺服器。
 *
 * 對外介面(subscribe/getVersion/setMapView/summon/settleOne/...)刻意跟
 * 單機版時期一樣,元件端幾乎不用改。
 */
export function createEngine() {
  let listeners = new Set();
  let version = 0;
  let mapView = null;
  let room = null;
  let rafId = 0, last = 0, uiAcc = 0;

  function notify() {
    version++;
    listeners.forEach(cb => cb());
  }

  function mirrorPlayers(state) {
    S.players = state.players.map(p => ({
      i: p.i, name: p.name, color: p.color, cls: p.cls, cash: p.cash, start: p.start,
      alive: p.alive, isBot: p.isBot, sessionId: p.sessionId, auto: p.auto, allin: p.allin,
      reliefT: p.reliefT, cd: Object.fromEntries(p.cd),
    }));
    S.myIndex = S.players.findIndex(p => p.sessionId && p.sessionId === S.mySessionId);
  }
  function mirrorUnits(state) {
    S.units = state.units.map(u => ({
      id: u.id, p: u.p, k: u.k, coin: u.coin, z: u.z, alive: u.alive,
      entry: u.entry, qty: u.qty, stake: u.stake, atk: u.atk,
      hp: u.hp, hpMax: u.hpMax, x: u.x, y: u.y, face: u.face,
      combatT: u.combatT, mineFx: u.mineFx, hitT: u.hitT, moved: u.moved, age: u.age,
      atkT: u.atkT, mineT: u.mineT,
    }));
  }
  function mirrorCoins(state) {
    state.coins.forEach((c, k) => {
      if (!COINS[k]) COINS[k] = { name: k, sub: "", hex: "#8A9583", hist: [] };
      COINS[k].price = c.price; COINS[k].ref = c.ref;
    });
  }
  function mirrorState(state) {
    S.phase = state.phase;
    S.running = state.running;
    S.over = state.over;
    S.t = state.t;
    S.evtT = state.evtT;
    S.hint = state.hint;
    S.roomCode = state.code;
    S.hostIndex = typeof state.hostIndex === "number" ? state.hostIndex : -1;
    setMode(state.mode);
    S.unlocked = state.unlocked;
    S.pending = state.pending ? { c: state.pending.c, f: state.pending.f, w: state.pending.w, t: state.pending.t } : null;
    S.trend = state.trend ? { c: state.trend.c, rate: state.trend.rate, t: state.trend.t, t2: state.trend.t2 } : null;
    mirrorCoins(state);
    mirrorPlayers(state);
    mirrorUnits(state);
  }

  function renderLoop(ts) {
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    if (S.fx.length) { S.fx.forEach(f => { f.t -= dt; }); S.fx = S.fx.filter(f => f.t > 0); }
    if (mapView) { mapView.drawUnits(); mapView.drawFx(); }
    uiAcc += dt;
    if (uiAcc >= 0.15) {
      uiAcc = 0;
      if (mapView) mapView.drawZoneFx();
      notify();
    }
    rafId = requestAnimationFrame(renderLoop);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* 三個入口(建立/加入/隨機)只差在怎麼跟 matchmaker 要房間,拿到 room 之後
     的綁定完全一樣,所以共用這一段。 */
  async function enterRoom(getRoom, code) {
    S.connectError = null;
    S.phase = "connecting";
    notify();
    try {
      const client = new Client(wsEndpoint());
      room = await getRoom(client);
      S.mySessionId = room.sessionId;
      S.connected = true;
      S.roomCode = code;

      room.onStateChange((state) => mirrorState(state));
      room.onMessage("fx", (batch) => {
        batch.forEach(f => S.fx.push({ ...f, t: FX_LIFE[f.k] || 0.3, life: FX_LIFE[f.k] || 0.3 }));
      });
      room.onMessage("sfx", (batch) => { batch.forEach(({ kind, vol }) => sfx(kind, vol)); });
      room.onMessage("toast", ({ msg, kind, ms }) => toast(msg, kind, ms));
      room.onMessage("gameOver", ({ stats, lessons }) => {
        S.stats = stats; S.lessonsCache = lessons; S.over = true; notify();
      });
      room.onLeave(() => { stop(); room = null; });

      notify();
      last = 0; uiAcc = 0;
      rafId = requestAnimationFrame(renderLoop);
    } catch (err) {
      room = null;
      S.phase = "entry";
      S.connected = false;
      S.connectError = friendlyError(err, code);
      notify();
    }
  }

  /* 建房時才送 mode:房間的模式由建房的人決定,加入的人是「進到那間房」,
     模式跟著房間走,所以 joinRoom 不送 mode。 */
  function createRoom(name, mode) {
    const code = makeRoomCode();
    const opts = { code, mode: mode === "simple" ? "simple" : "full" };
    if (name) opts.name = name;
    return enterRoom(c => c.create("game", opts), code);
  }
  function joinRoom(rawCode, name) {
    const code = normalizeCode(rawCode);
    if (code.length !== 4) {
      S.connectError = "房號要 4 位數字";
      notify();
      return Promise.resolve();
    }
    return enterRoom(c => c.join("game", name ? { code, name } : { code }), code);
  }
  function quickMatch(name, mode) {
    const m = mode === "simple" ? "simple" : "full";
    const code = PUBLIC_CODE[m];
    const opts = { code, mode: m };
    if (name) opts.name = name;
    return enterRoom(c => c.joinOrCreate("game", opts), code);
  }
  function leaveRoom() {
    if (room) { room.leave(); room = null; }
    stop();
    resetRoomState();
    notify();
  }

  /* 簡化版沒有「選目標格」這件事(伺服器也會忽略送上去的 zone),所以點地圖
     不留選取狀態,免得畫面上出現一個按了沒作用的高亮框。 */
  function selectTile(idx) { S.sel = S.mode === "simple" ? null : idx; notify(); }
  function selectUnit(id) { S.selU = (S.selU === id) ? null : id; notify(); }
  function focusUnit(u) {
    S.selU = u.id;
    if (mapView) mapView.focusOn(u.x, u.y);
    notify();
  }
  function flashUnit(k) { S.flashKey = k; S.flashUntil = performance.now() + 200; }

  function pickClass(clsKey) { room && room.send("pickClass", { clsKey }); }
  function startNow() { room && room.send("startNow"); }
  function summon(k) {
    flashUnit(k);
    room && room.send("summon", { k, zone: S.sel });
  }
  function allIn(k) { room && room.send("allIn", { k, zone: S.sel }); }
  function settleOne() {
    if (S.selU == null) return;
    room && room.send("settleOne", { unitId: S.selU });
  }
  function settleAll() { room && room.send("settleAll"); }
  function settleGroup(k, coin) { room && room.send("settleGroup", { k, coin }); }
  function toggleAuto() {
    const me = S.players[S.myIndex];
    if (!me) return;
    room && room.send("setAuto", { mode: me.auto === "sell" ? "hold" : "sell" });
  }
  function toggleSfx() {
    sfxInit();
    SFX.on = !SFX.on;
    if (SFX.on) sfx("buy", 1);
    notify();
  }

  return {
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    getVersion() { return version; },
    notify,
    setMapView(v) { mapView = v; },
    createRoom, joinRoom, quickMatch, leaveRoom, stop,
    pickClass, startNow,
    selectTile, selectUnit, focusUnit,
    settleOne, settleAll, settleGroup,
    summon, allIn,
    toggleAuto, toggleSfx,
  };
}
