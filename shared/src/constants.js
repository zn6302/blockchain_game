/* ============================ 資料 ============================ */
/* 全場只有一種幣：不會有「押錯幣種」這件事，漲跌就是所有人共同的行情。
   COINS 是有狀態的(price 會變動),所以用 factory 產生——client 每個分頁一份、
   server 每個房間一份,彼此獨立,不共用同一個物件。 */
const COIN_DEFS = {
  NOX: { name: "NOXCAT", sub: "NOX · 會漲會跌", price: 3.2, vol: 0.02, hex: "#91D500" }
};

export const CK = Object.keys(COIN_DEFS);
export function createCoins() {
  const coins = {};
  Object.keys(COIN_DEFS).forEach(k => {
    const price = COIN_DEFS[k].price;
    coins[k] = { ...COIN_DEFS[k], ref: price, hist: Array.from({ length: 40 }, () => price) };
  });
  return coins;
}

/* 每個兵種綁定一種幣：召喚＝買入那種幣，結算＝賣出 */
/* 每個兵種 = 固定的「幣量」，所以幣便宜時同一隻兵就便宜、幣貴時就買不起 */
/* 每張卡一次出三隻，所以單隻的幣量與數值都是原本的約 1/2.6 */
export const PACK = 3;
/* 全部綁 NOX(全場只有一種幣),qty 由便宜到貴排成一條升級曲線。
   戰鬥兵掛 late:true,前 60 秒鎖住,逼玩家先學會挖礦攢錢再開打。 */
export const UNITS = {
  miner: { g: "礦", n: "礦工", coin: "NOX", qty: 14.4, hp: 38, atk: 3, rng: 26, spd: 26, cd: 0.6, rate: 0.45, role: "mine" },
  soldier: { g: "兵", n: "士兵", coin: "NOX", qty: 22.2, hp: 80, atk: 10, rng: 34, spd: 36, cd: 0.7, role: "hunt", late: true },
  guard: { g: "守", n: "守衛", coin: "NOX", qty: 31.3, hp: 150, atk: 7, rng: 32, spd: 20, cd: 1.1, role: "hold" },
  assassin: { g: "刺", n: "刺客", coin: "NOX", qty: 34.7, hp: 48, atk: 20, rng: 26, spd: 62, cd: 1.5, role: "hunt", late: true },
  pro: { g: "超", n: "超級礦工", coin: "NOX", qty: 42.5, hp: 65, atk: 4, rng: 28, spd: 22, cd: 1.4, rate: 1.2, role: "mine" },
  para: { g: "傘", n: "傘兵", coin: "NOX", qty: 46, hp: 90, atk: 12, rng: 34, spd: 40, cd: 3.0, role: "drop" },
  titan: { g: "獸", n: "巨獸", coin: "NOX", qty: 0, hp: 600, atk: 46, rng: 40, spd: 24, cd: 0, role: "hunt", late: true }
};

/* 一局 180 秒，S.t 是倒數，所以 t > 120 就是「開場那 60 秒」。 */
export const LATE_T = 120;
export function isLocked(k, t) {
  return !!UNITS[k]?.late && t > LATE_T;
}
export function lockLeft(t) { return Math.max(0, Math.ceil(t - LATE_T)); }

export const PCOL = ["w", "c", "o", "p"];
/* 召喚列只放五張卡，由便宜到貴排。巨獸不在這排——它現在是梭哈青年的大招，
   其他身份這局根本召不出巨獸，所以每個人的第六個按鈕都是自己的那一招。 */
export const ROSTER = ["miner", "soldier", "guard", "assassin", "pro"];
export const ORDER_ALL = [...ROSTER, "titan"];
export const SPR_OF = { miner: "miner", guard: "guard", soldier: "soldier", assassin: "assassin", pro: "pro", titan: "titan" }; // 第六格＝來個大的
export const COIN_UNITS = { NOX: "所有貓咪" };
export const ALLIN_MIN = 300;

/* ============================ 大招 ============================ */
/* 一個身份一招，冷卻 60 秒（一場三分鐘 ≈ 放得了三次）。招式本身就是那個身份
   在現實裡對應的投資行為，賽後的 lessons 會把它翻成名詞講給玩家聽。
   min = 發動所需的最低 Cash（不足就按不下去，梭哈青年是把 Cash 全押出去）。 */
export const ULT_CD = 60;
export const ULTS = {
  office: {
    n: "定期定額", g: "DCA", spr: "pro", min: 120,
    d: "24 秒內每 3 秒自動買一隻礦工，不管幣價漲跌",
    term: "定期定額 · DCA"
  },
  saver: {
    n: "鎖倉", g: "STAKE", spr: "guard", min: 0,
    d: "12 秒內你的貓不會受傷，期間結算保證不虧本",
    term: "質押鎖倉 · Staking"
  },
  degen: {
    n: "巨獸 ALL-IN", g: "ALLIN", spr: "titan", min: ALLIN_MIN,
    d: "手上的 Cash 全押，召喚一隻巨獸",
    term: "部位大小 · Position Sizing"
  },
  insider: {
    n: "內線消息", g: "ALPHA", spr: "assassin", min: 0,
    d: "立刻知道下一則新聞，而且它 8 秒後才發動",
    term: "資訊優勢 · Information Edge"
  }
};
export const DCA_T = 24, DCA_EVERY = 3;      // 定期定額：總長 24 秒，每 3 秒買一次
export const STAKE_T = 12;                   // 鎖倉：12 秒無敵＋保本
export const ALPHA_T = 8;                    // 內線消息：新聞延後 8 秒才發動

/* 身份＝現實中不同的投資人處境：錢從哪來、有多少本金、承受得住多大波動 */
export const CLASSES = {
  office: {
    n: "小資上班族", g: "SALARY",
    d: "本金少，但薪水一直進來。",
    tags: ["$600", "收入 ×1.5"],
    cash: 600, incMul: 1.5, costMul: 1.0, fee: 0.005, cdMul: 0.8, mine: 1.1,
    lo: 0.8, hi: 1.25, lead: 6
  },
  saver: {
    n: "定存族", g: "SAVER",
    d: "本金厚、求穩，抱越久越賺。",
    tags: ["$1,500", "抗跌最強"],
    cash: 1500, incMul: 0.6, costMul: 1.0, fee: 0.003, cdMul: 1.0, mine: 1.0,
    lo: 0.85, hi: 1.15, lead: 6, loyal: true
  },
  degen: {
    n: "梭哈青年", g: "DEGEN",
    d: "賺賠都放大，一則新聞定生死。",
    tags: ["$900", "波動 ×2"],
    cash: 900, incMul: 1.0, costMul: 0.9, fee: 0.015, cdMul: 0.9, mine: 0.85,
    lo: 0.5, hi: 1.9, lead: 6
  },
  insider: {
    n: "消息靈通", g: "ALPHA",
    d: "比別人早知道消息，但情報要錢。",
    tags: ["$800", "預告 12 秒"],
    cash: 800, incMul: 1.0, costMul: 1.0, fee: 0.02, cdMul: 1.0, mine: 1.0,
    lo: 0.75, hi: 1.4, lead: 12, insight: true
  }
};
export const PLAYER_COLORS = ["#91D500", "#4FD1C5", "#F5A524", "#E2557A"];
export const AI_NAMES = ["巨鯨_0x7f", "散戶聯盟", "做市商 MM"];
