import { useState } from "react";
import { S } from "../game/state.js";
import { normalizeCode } from "../game/engine.js";
import { useEngineVersion } from "../hooks/useEngineStore.js";

/**
 * 進場畫面:決定「要跟誰同一間房」。
 * 建立房間會抽一組 4 位數房號,朋友在這裡輸入同一組號碼就會進到同一場。
 */
export default function EntryScreen({ engine }) {
  useEngineVersion(engine);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = code.length === 4;
  const run = (fn) => {
    if (busy) return;
    setBusy(true);
    Promise.resolve(fn()).finally(() => setBusy(false));
  };

  return (
    <div className="ov" id="entryOv">
      <div className="panel" style={{ maxWidth: 520 }}>
        <div className="eyebrow">NOXFLOW</div>
        <h3>開房間，或加入你的朋友！</h3>
        {/* 規則不在這頁講:等待室會再說一次開局條件,這裡只留選房間需要的規格。 */}
        <div className="entry-meta">3 分鐘 · 最多 4 人 · 空位由電腦補</div>

        {S.connectError && <div className="entry-err">{S.connectError}</div>}
        {busy && <div className="entry-busy">連線中…</div>}

        <button className="btn entry-main" disabled={busy} onClick={() => run(() => engine.createRoom())}>
          建立房間
        </button>

        <div className="entry-or">或輸入房號</div>

        <form
          className="entry-join"
          onSubmit={(e) => { e.preventDefault(); if (ready) run(() => engine.joinRoom(code)); }}
        >
          <input
            className="entry-code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000"
            aria-label="房號"
          />
          {/* 「加入」不用綠底:一個畫面上只能有一顆主要按鈕,不然綠色就不再代表
              「這是我們希望你按的那顆」。填滿房號後 disabled 解除就是足夠的訊號。 */}
          <button className="btn ghost" type="submit" disabled={busy || !ready}>加入</button>
        </form>

        {/* 這顆進的是共用的公開房:有人在等就一起打,沒人就是電腦補滿。
            叫「隨機配對」會讓人以為要等真人配對成功,結果是進去就開打——
            「直接開始」講的是真正的賣點:不用等。 */}
        <div className="foot" style={{ justifyContent: "center", marginTop: 14 }}>
          <button className="btn ghost" disabled={busy} onClick={() => run(() => engine.quickMatch())}>
           直接開始！ 
          </button>
        </div>
      </div>
    </div>
  );
}
