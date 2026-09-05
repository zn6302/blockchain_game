import { CK, COINS, CLASSES } from "./constants.js";
import { S, initPlayers } from "./state.js";
import { step, summon, allIn, settle, settleAll, settleGroup } from "./combat.js";
import { tickPrices, log } from "./economy.js";
import { toast } from "./toast.js";
import { SFX, sfxInit, sfx } from "./audio.js";

/**
 * 遊戲引擎：整合狀態(S) + RAF 主迴圈 + 節流通知 + 操作方法。
 * 對外用 subscribe/getVersion 給 useSyncExternalStore 用；元件直接讀 S 拿最新資料，
 * 不做一份「快照物件」，因為 S 本來就是整份遊戲共用的可變狀態（跟原始版本一致）。
 */
export function createEngine() {
  let listeners = new Set();
  let version = 0;
  let mapView = null;
  let last = 0, priceAcc = 0, uiAcc = 0, rafId = 0;

  function notify() {
    version++;
    listeners.forEach(cb => cb());
  }

  function loop(ts) {
    if (!S.running) return;
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    S.t -= dt; priceAcc += dt; uiAcc += dt;
    if (priceAcc >= 0.35) { tickPrices(priceAcc); priceAcc = 0; }
    step(dt);
    if (mapView) { mapView.drawUnits(); mapView.drawFx(); }
    if (uiAcc >= 0.2) {
      uiAcc = 0;
      if (mapView) mapView.drawZoneFx();
      notify();
    }
    if (S.t <= 0 || S.players.filter(p => p.alive).length <= 1) { finish(); return; }
    rafId = requestAnimationFrame(loop);
  }

  function finish() {
    S.running = false; S.over = true;
    notify();
  }

  function start(clsKey) {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('900 12px "Noto Sans TC"'); document.fonts.load('400 8px "Press Start 2P"');
    }
    CK.forEach(k => { COINS[k].ref = COINS[k].price; COINS[k].hist = Array.from({ length: 40 }, () => COINS[k].price); });
    S.cls = clsKey; initPlayers(clsKey);
    if (mapView) { mapView.render(); mapView.attachInteraction({ onSelectUnit: selectUnit }); mapView.setInitialCamera(); }
    log(`開局：${CLASSES[clsKey].n}`, "good");
    toast("先按左邊第一隻 <b>礦工</b>，派牠去礦區賺 Cash。", "warn", 5200);
    S.running = true; last = 0;
    notify();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    S.running = false;
  }

  function selectTile(idx) { S.sel = idx; notify(); }
  function selectUnit(id) {
    S.selU = (S.selU === id) ? null : id;
    notify();
  }
  function focusUnit(u) {
    S.selU = u.id;
    if (mapView) mapView.focusOn(u.x, u.y);
    notify();
  }

  function settleOne() {
    const u = S.units.find(x => x.id === S.selU && x.alive);
    if (u) { settle(u); notify(); }
  }
  function doSettleAll() { settleAll(); notify(); }
  function doSettleGroup(k, coin) { settleGroup(k, coin); notify(); }
  function doSummon(k) { summon(k); notify(); }
  function doAllIn(k) { allIn(k); notify(); }

  function toggleAuto() {
    const p = S.players[0];
    p.auto = p.auto === "sell" ? "hold" : "sell";
    log(p.auto === "sell" ? "礦工產出改為 <b>自動賣出</b>（穩定收 Cash）" : "礦工產出改為 <b>自動持有</b>（併進那隻貓身上，跟著漲跌）");
    notify();
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
    start, stop,
    selectTile, selectUnit, focusUnit,
    settleOne, settleAll: doSettleAll, settleGroup: doSettleGroup,
    summon: doSummon, allIn: doAllIn,
    toggleAuto, toggleSfx,
  };
}
