/* ============================ 資料 ============================ */
/* COINS 是有狀態的(price 會變動),所以用 factory 產生——client 每個分頁一份、
   server 每個房間一份,彼此獨立,不共用同一個物件。 */
const COIN_DEFS = {
  NOX: { name: "NOXCAT", sub: "NOX · 最穩定，幾乎不動", price: 1, vol: 0.0015, hex: "#A3E635" },
  CATN: { name: "貓薄荷幣", sub: "CATN · 中波動 · 後期強", price: 12.4, vol: 0.008, hex: "#4FD1C5" },
  MEOW: { name: "喵喵迷因幣", sub: "MEOW · 高波動 · 可能歸零", price: 3.2, vol: 0.022, hex: "#F5A524" }
};
export const CK = Object.keys(COIN_DEFS);
export function createCoins() {
  const coins = {};
  CK.forEach(k => {
    const price = COIN_DEFS[k].price;
    coins[k] = { ...COIN_DEFS[k], ref: price, hist: Array.from({ length: 40 }, () => price) };
  });
  return coins;
}

/* 每個兵種綁定一種幣：召喚＝買入那種幣，結算＝賣出 */
/* 每個兵種 = 固定的「幣量」，所以幣便宜時同一隻兵就便宜、幣貴時就買不起 */
/* 每張卡一次出三隻，所以單隻的幣量與數值都是原本的約 1/2.6 */
export const PACK = 3;
export const UNITS = {
  miner: { g: "礦", n: "礦工", coin: "CATN", qty: 3.7, hp: 38, atk: 3, rng: 26, spd: 26, cd: 0.6, rate: 0.45, role: "mine" },
  guard: { g: "守", n: "守衛", coin: "CATN", qty: 8.1, hp: 150, atk: 7, rng: 32, spd: 20, cd: 1.1, role: "hold" },
  soldier: { g: "兵", n: "士兵", coin: "MEOW", qty: 23, hp: 80, atk: 10, rng: 34, spd: 36, cd: 0.7, role: "hunt" },
  assassin: { g: "刺", n: "刺客", coin: "MEOW", qty: 36, hp: 48, atk: 20, rng: 26, spd: 62, cd: 1.5, role: "hunt" },
  pro: { g: "超", n: "超級礦工", coin: "NOX", qty: 136, hp: 65, atk: 4, rng: 28, spd: 22, cd: 1.4, rate: 1.2, role: "mine" },
  para: { g: "傘", n: "傘兵", coin: "NOX", qty: 150, hp: 90, atk: 12, rng: 34, spd: 40, cd: 3.0, role: "drop" },
  titan: { g: "獸", n: "巨獸", coin: "NOX", qty: 0, hp: 600, atk: 46, rng: 40, spd: 24, cd: 0, role: "hunt" }
};

export const PCOL = ["w", "c", "o", "p"];
export const ROSTER = ["miner", "soldier", "guard", "assassin", "pro", "titan"]; // 由便宜到貴排，越右邊越強
export const SPR_OF = { miner: "miner", guard: "guard", soldier: "soldier", assassin: "assassin", pro: "pro", titan: "titan" }; // 第六格＝來個大的
export const COIN_UNITS = { NOX: "超級礦工・巨獸", MEOW: "士兵・刺客", CATN: "礦工・守衛" };
export const ALLIN_MIN = 300;

/* 身份＝現實中不同的投資人處境：錢從哪來、有多少本金、承受得住多大波動 */
export const CLASSES = {
  office: {
    n: "小資上班族", g: "SALARY",
    d: "本金少，但每個月薪水會進來。適合細水長流。",
    tags: ["開局 $600", "收入 ×1.5", "波動影響小"],
    cash: 600, incMul: 1.5, costMul: 1.0, fee: 0.005, cdMul: 0.8, mine: 1.1,
    lo: 0.8, hi: 1.25, lead: 6
  },
  saver: {
    n: "定存族", g: "SAVER",
    d: "本金厚但求穩，漲跌對你的影響最小，抱越久越賺。",
    tags: ["開局 $1,500", "收入 ×0.6", "抱久加成"],
    cash: 1500, incMul: 0.6, costMul: 1.0, fee: 0.003, cdMul: 1.0, mine: 1.0,
    lo: 0.85, hi: 1.15, lead: 6, loyal: true
  },
  degen: {
    n: "梭哈青年", g: "DEGEN",
    d: "賺賠都放大，一則新聞就能翻身，也能翻船。",
    tags: ["波動影響 ×2", "召喚 −10%", "手續費 1.5%"],
    cash: 900, incMul: 1.0, costMul: 0.9, fee: 0.015, cdMul: 0.9, mine: 0.85,
    lo: 0.5, hi: 1.9, lead: 6
  },
  insider: {
    n: "消息靈通", g: "ALPHA",
    d: "你比別人早知道消息，也看得到幅度——但情報要花錢。",
    tags: ["預告 12 秒", "看得到幅度", "手續費 2%"],
    cash: 800, incMul: 1.0, costMul: 1.0, fee: 0.02, cdMul: 1.0, mine: 1.0,
    lo: 0.75, hi: 1.4, lead: 12, insight: true
  }
};
export const PLAYER_COLORS = ["#A3E635", "#4FD1C5", "#F5A524", "#E2557A"];
export const AI_NAMES = ["巨鯨_0x7f", "散戶聯盟", "做市商 MM"];
