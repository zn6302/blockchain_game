import { Room, ServerError } from "@colyseus/core";
import { CLASSES } from "@noxcat/shared/constants.js";
import { GameState, PlayerState } from "../schema/GameState.js";
import { createGameInstance } from "../game.js";
import { syncState } from "../sync.js";

const CLASS_KEYS = Object.keys(CLASSES);

export class ArenaRoom extends Room {
  maxClients = 4;

  /* options.code 就是房號。index.js 的 filterBy(["code"]) 已經保證進得來的人
     都是拿同一個房號配對的,這裡只是把它存進 state 給 client 顯示。 */
  onCreate(options) {
    this.setState(new GameState());
    this.state.code = String((options && options.code) || "");
    for (let i = 0; i < 4; i++) {
      this.state.players.push(new PlayerState({ i, isBot: true, name: `電腦 ${i + 1}` }));
    }

    this.seatOf = new Map();               // sessionId -> seat index
    this.clientsBySeat = [null, null, null, null];
    this.pickedClass = [null, null, null, null];
    this.matchStarted = false;

    this.game = createGameInstance({
      emit: (type, payload, targetPi) => {
        if (targetPi != null) {
          const c = this.clientsBySeat[targetPi];
          if (c) c.send(type, payload);
        } else {
          this.broadcast(type, payload);
        }
      },
    });

    this.onMessage("pickClass", (client, msg) => {
      if (this.state.phase !== "lobby") return;
      const pi = this.seatOf.get(client.sessionId);
      if (pi == null) return;
      const clsKey = msg && msg.clsKey;
      if (!CLASS_KEYS.includes(clsKey)) return;
      this.pickedClass[pi] = clsKey;
      this.state.players[pi].cls = clsKey;
    });
    this.onMessage("startNow", (client) => {
      if (this.state.phase !== "lobby") return;
      if (!this.seatOf.has(client.sessionId)) return;
      this.startMatch();
    });
    this.onMessage("summon", (client, msg) =>
      this.forSeat(client, pi => this.game.summon(pi, msg && msg.k, msg && msg.zone)));
    this.onMessage("allIn", (client, msg) =>
      this.forSeat(client, pi => this.game.allIn(pi, msg && msg.k, msg && msg.zone)));
    this.onMessage("settleOne", (client, msg) =>
      this.forSeat(client, pi => this.game.settleOneById(pi, msg && msg.unitId)));
    this.onMessage("settleGroup", (client, msg) =>
      this.forSeat(client, pi => this.game.settleGroup(pi, msg && msg.k, msg && msg.coin)));
    this.onMessage("settleAll", (client) =>
      this.forSeat(client, pi => this.game.settleAll(pi)));
    this.onMessage("setAuto", (client, msg) =>
      this.forSeat(client, pi => {
        const p = this.game.S.players[pi];
        if (p) p.auto = (msg && msg.mode === "hold") ? "hold" : "sell";
      }));

    /* 沒有倒數自動開局:有房號以後大家是「約好了才進來」,倒數只會在人到齊前
       就把比賽開掉。開局時機改成房內任何一個人按「開始遊戲」,或四個真人都到齊。 */
  }

  onJoin(client, options) {
    if (this.state.phase !== "lobby") throw new ServerError(4001, "這一場已經開始了");
    const seatIdx = this.state.players.findIndex(p => p.isBot);
    if (seatIdx === -1) throw new ServerError(4002, "房間已經滿了");
    const seat = this.state.players[seatIdx];
    seat.isBot = false;
    seat.sessionId = client.sessionId;
    seat.name = (options && options.name) || `玩家${seatIdx + 1}`;
    this.seatOf.set(client.sessionId, seatIdx);
    this.clientsBySeat[seatIdx] = client;

    if (this.humanCount() === 4) this.startMatch();
  }

  async onLeave(client) {
    const pi = this.seatOf.get(client.sessionId);
    if (pi == null) return;
    const seat = this.state.players[pi];
    this.clientsBySeat[pi] = null;

    if (this.state.phase === "lobby") {
      seat.isBot = true; seat.sessionId = ""; seat.name = "";
      this.pickedClass[pi] = null;
      this.seatOf.delete(client.sessionId);
      return;
    }

    // 中途離線:座位立刻變成 bot 接手,比賽不會卡住;給 20 秒讓玩家重連搶回來。
    if (this.game) { const p = this.game.S.players[pi]; if (p) p.isBot = true; }
    try {
      await this.allowReconnection(client, 20);
      seat.sessionId = client.sessionId;
      this.seatOf.set(client.sessionId, pi);
      this.clientsBySeat[pi] = client;
      if (this.game) { const p = this.game.S.players[pi]; if (p) p.isBot = false; }
    } catch {
      // 逾時沒重連,這局剩下的時間永久由 bot 頂替
    }
  }

  humanCount() {
    return this.state.players.filter(p => !p.isBot).length;
  }

  forSeat(client, fn) {
    if (this.state.phase !== "playing") return;
    const pi = this.seatOf.get(client.sessionId);
    if (pi == null) return;
    const seat = this.state.players[pi];
    if (!seat || seat.isBot) return; // 離線中的座位現在是 bot,擋掉偽造的操作
    fn(pi);
  }

  startMatch() {
    if (this.state.phase !== "lobby" || this.matchStarted) return;
    this.matchStarted = true;
    this.lock();

    const taken = new Set(this.pickedClass.filter(Boolean));
    const seats = this.state.players.map((seat, i) => {
      let cls = this.pickedClass[i];
      if (!cls) {
        const pool = CLASS_KEYS.filter(c => !taken.has(c));
        cls = pool.length ? pool[Math.floor(Math.random() * pool.length)] : CLASS_KEYS[Math.floor(Math.random() * CLASS_KEYS.length)];
        taken.add(cls);
      }
      return { cls, isBot: seat.isBot, name: seat.name };
    });
    this.game.initPlayers(seats);
    seats.forEach((s, i) => { this.state.players[i].cls = s.cls; });

    this.state.phase = "playing";
    this.state.running = true;

    let priceAcc = 0, flushAcc = 0;
    this.setTimestep((deltaMs) => {
      if (this.state.phase !== "playing") return;
      const dt = Math.min(0.05, deltaMs / 1000);
      priceAcc += dt; flushAcc += dt;
      if (priceAcc >= 0.35) { this.game.tickPrices(priceAcc); priceAcc = 0; }
      this.game.step(dt);
      this.game.S.t -= dt;
      if (flushAcc >= 0.1) { this.game.flushEvents(); flushAcc = 0; }
      syncState(this.state, this.game);
      if (this.game.S.t <= 0 || this.game.alivePlayerCount() <= 1) this.finish();
    }, 1000 / 60);
    this.setPatchRate(50);
  }

  finish() {
    if (this.state.phase === "ended") return;
    this.state.phase = "ended";
    this.state.over = true;
    this.state.running = false;
    this.clientsBySeat.forEach((c, pi) => {
      if (c) c.send("gameOver", { stats: this.game.statsFor(pi), lessons: this.game.lessonsFor(pi) });
    });
    this.clock.setTimeout(() => this.disconnect(), 8000);
  }
}
