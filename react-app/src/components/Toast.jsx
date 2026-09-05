import { useSyncExternalStore } from "react";
import { getToastSnapshot, subscribeToast } from "../game/toast.js";

export default function Toast() {
  const snap = useSyncExternalStore(subscribeToast, getToastSnapshot, getToastSnapshot);
  return (
    <div
      className={`toast ${snap.on ? "on " : ""}${snap.kind}`}
      id="toast"
      dangerouslySetInnerHTML={{ __html: snap.msg }}
    />
  );
}
