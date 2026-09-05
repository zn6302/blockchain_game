import { ULTS } from "@noxcat/shared/constants.js";
import { CLS_ICON } from "../game/classIcons.js";
import { S } from "../game/state.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";

/* 發動大招時蓋在地圖中間的橫幅。刻意只給發動的那個人看：別人放招場上已經有
   一整套特效在講了，四個人的招輪流蓋在畫面中央只會擋住正在打的那場仗。
   key={seq} 是為了讓連放兩次時 CSS 動畫重跑一遍——同一個節點改內容不會重播。
   收掉的時機靠 engine 每 0.15 秒的 notify 掃到 until，不另外開 timer。 */
export default function UltCast({ engine }) {
  useEngineVersion(engine);
  const c = S.ultCast;
  if (!c || performance.now() > c.until) return null;
  const ult = ULTS[c.cls];
  if (!ult) return null;
  return (
    <div className="ultcast" key={c.seq} style={{ "--ucol": ult.hex }}>
      <img src={CLS_ICON[c.cls]} alt="" />
      {/* 只放代號＋名字:招式在做什麼,伺服器那則 toast 已經寫得很清楚了,
          兩邊都寫一次會變成同一句話蓋在畫面上兩份。 */}
      <span className="uctext">
        <i className="ucg">{ult.g}</i>
        <b className="ucn">{ult.n}</b>
      </span>
    </div>
  );
}
