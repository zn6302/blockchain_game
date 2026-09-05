import { UNITS } from "./constants.js";
import { S, money, posTotal, netWorth } from "./state.js";

export function lessons() {
  const st = S.stats, me = S.players[0], out = [];
  const open = posTotal(me), total = netWorth(me);
  const pctOf = (v) => Math.round(v / Math.max(1, st.invested) * 100);
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
  if (st.rugged) {
    out.push(["抽地毯 · Rug Pull", "項目方跑了，幣一秒變壁紙",
      `喵喵迷因幣這局被抽乾流動性、直接歸零${st.rugLoss > 1 ? `，你手上 ${money(st.rugLoss)} 的部位跟著蒸發` : ""}。
       現實裡也有：<b>項目方把資金池抽走，幣一秒變壁紙</b>，而且再也買不回來。`]);
  }
  const sp = st.spend, tot = sp.NOX + sp.CATN + sp.MEOW;
  if (tot > 200) {
    const top = Object.keys(sp).sort((a, b) => sp[b] - sp[a])[0], share = Math.round(sp[top] / tot * 100);
    if (share >= 60) out.push(["集中風險 · Concentration Risk", "你把雞蛋放在同一個籃子",
      `這局有 ${share}% 的錢押在 <b>${top}</b> 上。集中持有會把賺跟賠一起放大；
       分散到不同幣，整體起伏會小很多。`]);
    else out.push(["分散投資 · Diversification", "你有做到分散",
      `你的錢分散在不同幣種（最高只佔 ${share}%），所以單一幣崩盤時不會整組陣亡——
       這就是<b>分散投資</b>在做的事。`]);
  }
  if (st.holdN >= 2) {
    const avg = st.holdSum / st.holdN;
    if (avg < 14) out.push(["手續費侵蝕 · Fee Drag", "你是短線玩家",
      `你平均只抱 ${avg.toFixed(0)} 秒就結算。頻繁進出能鎖住小獲利，
       但<b>每次買賣都要付手續費</b>，次數一多就會吃掉利潤。`]);
    else if (avg > 45) out.push(["長期持有 · HODL", "你是長抱玩家",
      `你平均抱了 ${avg.toFixed(0)} 秒。抱久了能吃到整段趨勢，
       但也要<b>忍受中間的上下震盪</b>，而且錢卡著就不能拿去做別的事。`]);
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
