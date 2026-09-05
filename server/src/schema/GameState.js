import { schema, t } from "@colyseus/schema";

/* 只放「真的需要同步給每個 client」的欄位。
   S.fx/S.logs/每人的 stats/incT/aiNext 都刻意留在 server 的 plain state 裡,
   不進 schema——詳見 shared 計畫文件裡「哪些東西真的要同步」那一節。 */

export const CoinState = schema({
  price: t.number().default(0),
  ref: t.number().default(0),
}, "CoinState");

export const UnitState = schema({
  id: t.number().default(0),
  p: t.uint8().default(0),
  k: t.string().default(""),
  coin: t.string().default(""),
  z: t.uint8().default(0),
  alive: t.boolean().default(true),
  entry: t.number().default(0),
  qty: t.number().default(0),
  stake: t.number().default(0),
  atk: t.number().default(0),
  hp: t.number().default(0),
  hpMax: t.number().default(0),
  x: t.number().default(0),
  y: t.number().default(0),
  face: t.int8().default(1),
  combatT: t.number().default(0),
  mineFx: t.number().default(0),
  hitT: t.number().default(0),
  moved: t.number().default(0),
  age: t.number().default(0),
  atkT: t.number().default(0),
  mineT: t.number().default(1),
}, "UnitState");

export const PlayerState = schema({
  i: t.uint8().default(0),
  name: t.string().default(""),
  color: t.string().default(""),
  cls: t.string().default(""),
  cash: t.number().default(0),
  start: t.number().default(0),
  alive: t.boolean().default(true),
  isBot: t.boolean().default(true),
  sessionId: t.string().default(""),
  auto: t.string().default("sell"),
  allin: t.boolean().default(false),
  reliefT: t.number().default(4),
  cd: t.map(t.number()),
}, "PlayerState");

export const MarketEventState = schema({
  c: t.string().default(""),
  f: t.number().default(1),
  w: t.string().default(""),
  t: t.string().default(""),
}, "MarketEventState");

export const TrendState = schema({
  c: t.string().default(""),
  rate: t.number().default(0),
  t: t.number().default(0),
  t2: t.string().default(""),
}, "TrendState");

export const GameState = schema({
  phase: t.string().default("lobby"),   // "lobby" | "playing" | "ended"
  running: t.boolean().default(false),
  over: t.boolean().default(false),
  t: t.number().default(180),
  evtT: t.number().default(10),
  hint: t.string().default(""),
  lobbyDeadline: t.number().default(0), // epoch ms,client 算倒數用
  coins: t.map(CoinState),
  units: t.array(UnitState),
  players: t.array(PlayerState),
  pending: t.ref(MarketEventState).optional(),
  trend: t.ref(TrendState).optional(),
}, "GameState");
