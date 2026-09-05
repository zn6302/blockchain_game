import { CLASSES } from "../game/constants.js";
import RoomCode from "./RoomCode.jsx";

export default function SelectScreen({ onPick }) {
  return (
    <div className="ov" id="selectOv">
      <div className="panel">
        <div className="eyebrow">區塊鏈大戰爭 · 3 分鐘 · 4 人</div>
        <RoomCode />
        <h3>召喚貓咪＝買幣，撤回＝賣幣</h3>
        <div className="steps">
          <div className="st"><b>1</b><span>按貓咪</span><i>花 Cash 買那種幣</i></div>
          <div className="st"><b>2</b><span>幣漲</span><i>牠變強，值更多錢</i></div>
          <div className="st"><b>3</b><span>按結算</span><i>賣掉換回 Cash</i></div>
        </div>
        <p className="lead">貓死了，那筆錢也沒了。<b style={{ color: "var(--lime)" }}>三分鐘後最有錢的人贏。</b></p>
        <div className="pick">你是哪一種投資人？</div>
        <div className="classes" id="classes">
          {Object.entries(CLASSES).map(([k, c]) => (
            <button className="cls" data-c={k} key={k} onClick={() => onPick(k)}>
              <div className="cg">{c.g}</div><h4>{c.n}</h4><p>{c.d}</p>
              <div className="roster">{c.tags.map((t, i) => <span key={i}>{t}</span>)}</div>
              <div className="stat">
                <span>開局 ${c.cash.toLocaleString()}</span>
                <span>幣價影響 {Math.round(c.lo * 100)}–{Math.round(c.hi * 100)}%</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
