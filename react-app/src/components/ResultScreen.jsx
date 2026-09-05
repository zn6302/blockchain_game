import { S, money, netWorth } from "../game/state.js";
import { IP_CAT } from "../game/classIcons.js";

export default function ResultScreen() {
  const rank = [...S.players].sort((a, b) => (b.alive - a.alive) || (netWorth(b) - netWorth(a)));
  const win = rank[0], meWin = win.i === S.myIndex;
  const me = S.players[S.myIndex], st = S.stats;
  const chg = st && me ? netWorth(me) / me.start - 1 : 0;
  const lessons = S.lessonsCache || [];

  if (!me || !st) return null;

  return (
    <div className="ov" id="resultOv">
      <div className="panel" style={{ maxWidth: 620, maxHeight: "88vh", overflowY: "auto" }}>
        <div className="ipres">
          <img src={IP_CAT} alt="NOXCAT" />
          <div className="reshead">
            <div className="eyebrow" id="resTag">{meWin ? "VICTORY" : "DEFEAT"}</div>
            <h3 id="resTitle">{meWin ? "你活下來，而且錢最多" : "你不是場上最有錢的"}</h3>
            <p className="lead" id="resLead">
              三分鐘結束，{win.name} 以 {money(netWorth(win))} 的資產獲勝。未結算的部隊按當下幣價計入。
            </p>
          </div>
        </div>
        <div className="result" id="resList">
          {rank.map((p, i) => (
            <div className={`rrow ${i === 0 ? "win" : ""}`} key={p.i}>
              <span><i className="dot" style={{ background: p.color, display: "inline-block", marginRight: 8 }}></i>
                {i + 1}. {p.name}{p.alive ? "" : "（出局）"}</span>
              <span className="v" style={{ color: p.color }}>{money(netWorth(p))}</span>
            </div>
          ))}
        </div>
        <div className="ressum" id="resSum">
          你從 {money(me.start)} 走到 <b style={{ color: chg >= 0 ? "var(--up)" : "var(--down)" }}>{money(netWorth(me))}</b>
          （{chg >= 0 ? "+" : "−"}{Math.abs(chg * 100).toFixed(0)}%）· 買入 {st.buys} 次 · 結算 {st.sells} 次 ·
          已實現損益 <b style={{ color: st.realized >= 0 ? "var(--up)" : "var(--down)" }}>
            {st.realized >= 0 ? "+" : "−"}{money(Math.abs(st.realized))}</b>
        </div>
        <div className="lsnhead">你剛剛做的事，其實都有名字</div>
        <div className="lessons" id="lessons">
          {/* 課文裡的 <b> 是伺服器那份常數自己帶的重點標記（不是玩家輸入），
              直接當文字render 會在畫面上看到 <b> 字樣，所以這裡照 HTML 解。 */}
          {lessons.map(([term, t, d], i) => (
            <div className="lsn" key={i}><i className="term">{term}</i><b>{t}</b>
              <p dangerouslySetInnerHTML={{ __html: d }} /></div>
          ))}
        </div>
        <div className="foot"><button className="btn" onClick={() => location.reload()}>再來一場</button></div>
      </div>
    </div>
  );
}
