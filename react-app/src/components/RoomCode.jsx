import { useState } from "react";
import { S } from "../game/state.js";
import { isPublicCode } from "../game/engine.js";

/**
 * 房號本身就是邀請碼,所以讓它大到隔壁桌唸得出來、按一下就複製。
 * 選角色和大廳都會用到——建房的人在選角色時就該看得到號碼,才能馬上發給朋友。
 */
export default function RoomCode() {
  const [copied, setCopied] = useState(false);
  const code = S.roomCode;

  if (!code) return null;
  if (isPublicCode(code)) {
    return <div className="roomcode"><span className="roomcode-label">隨機配對房</span></div>;
  }

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }, () => {});
  };

  return (
    <div className="roomcode">
      <span className="roomcode-label">房號</span>
      <button className="roomcode-num" onClick={copy} title="按一下複製">{code}</button>
      {copied && <span className="roomcode-hint">已複製</span>}
    </div>
  );
}
