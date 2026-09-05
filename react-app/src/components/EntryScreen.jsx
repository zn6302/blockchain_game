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
  /* 模式只在「建立房間/隨機配對」時有意義——用房號加入的人是進到別人開的房,
     那間房是哪種模式在建立時就定死了,所以下面的加入按鈕不帶 mode。 */
  const [mode, setMode] = useState("full");

  const ready = code.length === 4;
  const run = (fn) => {
    if (busy) return;
    setBusy(true);
    Promise.resolve(fn()).finally(() => setBusy(false));
  };

  return (
    <div className="ov" id="entryOv">
      <div className="panel" style={{ maxWidth: 520 }}>
        <div className="eyebrow">NOXCAT ARENA</div>
        <h3>開一間房，或用房號加入朋友</h3>
        <p className="lead">
          一場 3 分鐘、最多 4 人。人不夠的座位由電腦接手，
          <b style={{ color: "var(--lime)" }}>房內任何人按「開始遊戲」就開局</b>。
        </p>

        {S.connectError && <div className="entry-err">{S.connectError}</div>}
        {busy && <div className="entry-busy">連線中…</div>}

        <div className="modepick">
          <button type="button" className={`mp ${mode === "full" ? "on" : ""}`} onClick={() => setMode("full")}>
            <b>完整版</b>
            <span>三種幣、自己選目標格子</span>
          </button>
          <button type="button" className={`mp ${mode === "simple" ? "on" : ""}`} onClick={() => setMode("simple")}>
            <b>簡化版</b>
            <span>只有一種幣、貓自己找路、前 60 秒只能挖礦</span>
          </button>
        </div>

        <button className="btn entry-main" disabled={busy} onClick={() => run(() => engine.createRoom(null, mode))}>
          建立{mode === "simple" ? "簡化版" : "完整版"}房間
        </button>

        <div className="entry-or">或者輸入房號</div>

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
          <button className="btn" type="submit" disabled={busy || !ready}>加入</button>
        </form>

        <div className="foot" style={{ justifyContent: "center", marginTop: 14 }}>
          <button className="btn ghost" disabled={busy} onClick={() => run(() => engine.quickMatch(null, mode))}>
            隨機配對（跟正在等的人湊一場）
          </button>
        </div>
      </div>
    </div>
  );
}
