import { useSyncExternalStore } from "react";

/**
 * 訂閱 engine 的版本號（每次 notify() 就 +1）。
 * 元件拿到新版本號就會重新 render，直接讀 S/COINS 等可變狀態即可 —
 * 這裡不做「快照物件」，因為 S 本來就是整份遊戲共用的可變資料。
 */
export function useEngineVersion(engine) {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
}
