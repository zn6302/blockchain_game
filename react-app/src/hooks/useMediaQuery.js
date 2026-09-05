import { useSyncExternalStore } from "react";

/**
 * 訂閱一組 media query，回傳它現在有沒有命中。
 *
 * 用途是讓元件知道「CSS 現在把某塊東西藏起來了」——原型是用
 * getComputedStyle(#troopbox).display 去讀，React 這邊不好在 render 當下
 * 量 DOM，所以改成把同一組斷點寫成 query 直接問瀏覽器。
 * 代價是斷點在 CSS 與這裡各寫一次，改其中一邊要記得改另一邊。
 */
const cache = new Map();
function storeFor(query) {
  let s = cache.get(query);
  if (!s) {
    const mql = matchMedia(query);
    s = {
      subscribe(cb) { mql.addEventListener("change", cb); return () => mql.removeEventListener("change", cb); },
      get: () => mql.matches
    };
    cache.set(query, s);
  }
  return s;
}
export function useMediaQuery(query) {
  const s = storeFor(query);
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

/* 右側「我的部隊」面板在這個寬度以下會被 CSS 收起來（index.css 的
   `@media (max-width:1120px){ .troops{display:none} }`）。 */
export const TROOP_PANEL_HIDDEN = "(max-width:1120px)";
