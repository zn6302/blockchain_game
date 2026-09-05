import { CLASSES } from "../game/constants.js";
import { ULTS } from "@noxcat/shared/constants.js";
import { CLS_ICON, IP_CAT, NOX_WORD } from "../game/classIcons.js";
import RoomCode from "./RoomCode.jsx";

export default function SelectScreen({ onPick }) {
  return (
    <div className="ov" id="selectOv">
      <div className="panel">
        <div className="iphero">
          <img className="ipcat" src={IP_CAT} alt="NoxFlow" />
          <img className="ipword" src={NOX_WORD} alt="NoxFlow" />
        </div>
        <div className="eyebrow">3 分鐘 · 4 人</div>
        <RoomCode />
        <h3>買貓咪＝買幣，結算＝賣幣</h3>
        <p className="lead">最有錢的人贏，剩下的進去再說。</p>
        <div className="pick">你是哪一種投資人？</div>
        {/* 身份現在還決定你的大招，所以每張卡下面多一條寫清楚那一招是什麼——
            這是選身份時最該知道的事，不能等到進場才在操作列上發現。 */}
        <div className="classes" id="classes">
          {Object.entries(CLASSES).map(([k, c]) => (
            <button className="cls" data-c={k} key={k} onClick={() => onPick(k)}>
              <div className="chead">
                <img className="cspr" src={CLS_ICON[k]} alt="" />
                <div className="cwho"><div className="cg">{c.g}</div><h4>{c.n}</h4></div>
              </div>
              <p>{c.d}</p>
              <div className="roster">{c.tags.map((t, i) => <span key={i}>{t}</span>)}</div>
              {ULTS[k] && <div className="ultrow"><b>大招 · {ULTS[k].n}</b><i>{ULTS[k].d}</i></div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
