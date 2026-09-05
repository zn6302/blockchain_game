import { UNITS } from "../game/constants.js";
import { S, money, settleValue } from "../game/state.js";

/**
 * 結算＝賣出的那一欄。
 *
 * 它會出現在兩個地方：桌機貼在右側「我的部隊」面板下面（賣掉誰跟賣多少
 * 就在同一塊，眼睛不用在畫面兩端來回跑），面板被收起來的窄畫面才退回
 * 操作列。兩邊是同一個元件，只是掛在不同的父節點底下。
 */
export default function SettleActions({ engine }) {
  if (!S.players[S.myIndex]) return null;
  const mineUnits = S.units.filter(u => u.alive && u.p === S.myIndex);
  const sel = S.units.find(x => x.id === S.selU && x.alive);
  const total = mineUnits.reduce((s, u) => s + settleValue(u), 0);

  return (
    <div className="dockcol" id="actsCol">
      <span className="lab">結算＝賣出</span>
      <div className="acts">
        <button className={`a ${!sel ? "off" : ""}`} id="settleOne" onClick={() => engine.settleOne()}>
          <span className="t">結算 <b style={{ fontFamily: "var(--mono)", fontWeight: 400 }}>Q</b></span>
          <span className="d" id="settleInfo">{sel ? `${UNITS[sel.k].n} · ${sel.coin}` : "先點自己的部隊"}</span>
          <span className="p" id="settleVal">{sel ? "取回 " + money(settleValue(sel)) : "—"}</span>
        </button>
        <button className={`a ${!mineUnits.length ? "off" : ""}`} id="settleAll" onClick={() => engine.settleAll()}>
          <span className="t">全部結算 <b style={{ fontFamily: "var(--mono)", fontWeight: 400 }}>E</b></span>
          <span className="d">撤回所有部隊</span>
          <span className="p" id="settleAllVal">{mineUnits.length ? "取回 " + money(total) : "—"}</span>
        </button>
      </div>
    </div>
  );
}
