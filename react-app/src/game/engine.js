import { Client } from "@colyseus/sdk";
import { S, resetRoomState } from "./state.js";
import { COINS, PLAYER_COLORS } from "./constants.js";
import { toast } from "./toast.js";
import { SFX, sfxInit, sfx } from "./audio.js";

/* 伺服器只送「這個事件發生了」的資料(k/x/y/...),沒有帶存活時間——
   存活時間是純視覺概念,原本活在 combat.js 的 fx.js 裡,現在搬到這裡, "接到就補上"。 */
const FX_LIFE = { shot: 0.13, hit: 0.24, dmg: 0.85, kill: 0.5, coin: 1.05 };

/* 幣價走勢圖要有一段歷史才畫得出來,但伺服器只同步「現在的價格」——歷史純粹是
   看的,每個 client 自己留一份就好,不值得每個 tick 多送 40 個數字上線。這裡照
   伺服器 tickPrices 的節奏(0.35s)自己往後推,取樣密度跟伺服器一致。 */
const HIST_N = 40, HIST_EVERY = 0.35;

/* 開發時前端在 vite 的 5173、伺服器在 2567,是兩個 port;
   上線後同一個容器既送網頁也開 WebSocket,是同一個 origin——
   所以 prod 用 location.host(帶著這一頁的 port,https 頁面自動走 wss),
   不能寫死 :2567,雲端平台對外只有 443。
   dev 用 hostname 而不是寫死 localhost,手機連區網 IP 進來才接得到同一台機器。 */
function wsEndpoint() {
  const override = import.meta.env.VITE_SERVER_URL;
  if (override) return override;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.DEV) return `${proto}//${location.hostname}:2567`;
  return `${proto}//${location.host}`;
}

/* ---------------- 房號配對 ----------------
   房號就是伺服器 filterBy(["code"]) 用的鍵:同一個 code 才會配到同一間房。
   建房用 joinOrCreate 而不是 create——萬一兩個人剛好抽到同一組號碼,
   後來的那個人是「加入同號房」,而不是開出第二間同號房讓別人配錯邊。 */
/* 隨機配對共用的公共房。抽號從 1000 起,不會撞到這一組。 */
const PUBLIC_CODE = "0001";

export function makeRoomCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}
export function normalizeCode(raw) {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 4);
}
export function isPublicCode(code) {
  return code === PUBLIC_CODE;
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
  let rafId = 0, last = 0, uiAcc = 0, histAcc = 0;
  let histSeeded = false;

  function notify() {
    version++;
    listeners.forEach(cb => cb());
  }

  function mirrorPlayers(state) {
    S.players = state.players.map(p => ({
      /* 顏色是座位編號的純函數(跟 mapEngine/Dock 用的同一份 PLAYER_COLORS),
         不必占一條每個人都算得出來的同步欄位。 */
      i: p.i, name: p.name, color: PLAYER_COLORS[p.i], cls: p.cls, cash: p.cash, start: p.start,
      alive: p.alive, isBot: p.isBot, sessionId: p.sessionId, allin: p.allin,
      reliefT: p.reliefT, ultCd: p.ultCd, lockT: p.lockT, cd: Object.fromEntries(p.cd),
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
    /* 第一次拿到伺服器的價格時把整條歷史鋪平成當下的價格,不然走勢圖會從
       constants.js 的預設價一路衝到實際價,開場先給玩家看一根假的暴漲。 */
    if (!histSeeded) {
      Object.keys(COINS).forEach(k => { COINS[k].hist = Array.from({ length: HIST_N }, () => COINS[k].price); });
      histSeeded = true;
    }
  }
  function pushHist() {
    Object.keys(COINS).forEach(k => {
      const c = COINS[k];
      if (!c.hist) c.hist = [];
      c.hist.push(c.price);
      while (c.hist.length > HIST_N) c.hist.shift();
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
    histAcc += dt;
    if (histAcc >= HIST_EVERY) { histAcc = 0; pushHist(); }
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
      last = 0; uiAcc = 0; histAcc = 0; histSeeded = false;
      rafId = requestAnimationFrame(renderLoop);
    } catch (err) {
      room = null;
      S.phase = "entry";
      S.connected = false;
      S.connectError = friendlyError(err, code);
      notify();
    }
  }

  function createRoom(name) {
    const code = makeRoomCode();
    const opts = { code };
    if (name) opts.name = name;
    return enterRoom(c => c.joinOrCreate("arena", opts), code);
  }
  function joinRoom(rawCode, name) {
    const code = normalizeCode(rawCode);
    if (code.length !== 4) {
      S.connectError = "房號要 4 位數字";
      notify();
      return Promise.resolve();
    }
    return enterRoom(c => c.join("arena", name ? { code, name } : { code }), code);
  }
  function quickMatch(name) {
    const code = PUBLIC_CODE;
    const opts = { code };
    if (name) opts.name = name;
    return enterRoom(c => c.joinOrCreate("arena", opts), code);
  }
  function leaveRoom() {
    if (room) { room.leave(); room = null; }
    histSeeded = false;
    stop();
    resetRoomState();
    notify();
  }

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
    room && room.send("summon", { k });
  }
  /* 大招:能不能放、放了會怎樣全部由伺服器判斷,client 只負責把按鈕閃一下,
     免得同一顆按鈕在本地與伺服器各有一套規則,兩邊對不起來。 */
  function useUlt() {
    flashUnit("ult");
    room && room.send("useUlt");
  }
  /* 沒選單位也照送:該不該罵人由伺服器決定,client 這邊自己 return 掉的話
     玩家會覺得按鈕壞了(按了完全沒反應,連提示都沒有)。 */
  function settleOne() {
    room && room.send("settleOne", { unitId: S.selU });
  }
  function settleAll() { room && room.send("settleAll"); }
  function settleGroup(k, coin) { room && room.send("settleGroup", { k, coin }); }
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
    homeCamera() { mapView && mapView.home(); },
    createRoom, joinRoom, quickMatch, leaveRoom, stop,
    pickClass, startNow,
    selectUnit, focusUnit,
    settleOne, settleAll, settleGroup,
    summon, useUlt,
    toggleSfx,
  };
}
