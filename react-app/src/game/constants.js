export * from "@noxcat/shared/constants.js";
import { createCoins, unitsFor, coinKeysFor, coinUnitsFor } from "@noxcat/shared/constants.js";
import { zinfoFor } from "@noxcat/shared/board.js";

/* 這局是完整版還是簡化版由伺服器決定(建房時定死),連上之後 engine.js 收到
   state.mode 就呼叫 applyMode()。兩種模式的兵種表/礦區表/幣種都不一樣。

   UNITS/ZINFO/CK/COIN_UNITS 是唯讀的表,所以直接換掉整個 binding——元件都是在
   render 當下才讀(UNITS[k]),換完下一次 render 就是新的。這裡的名字會蓋掉上面
   `export *` 從 shared 帶進來的同名常數(區域 export 優先)。 */
export let MODE = "full";
export let UNITS = unitsFor(MODE);
export let ZINFO = zinfoFor(MODE);
export let CK = coinKeysFor(MODE);
export let COIN_UNITS = coinUnitsFor(MODE);

/* COINS 相反,是「被原地寫入」的物件:engine.js 每次收到伺服器狀態都往裡面寫
   price,而且 state.js 的 ctx 直接抓著這個物件的參考。所以換模式時只能原地
   增刪鍵,不能整個換掉——換掉的話 ctx.COINS 會繼續指向舊物件。 */
export const COINS = createCoins(MODE);

export function applyMode(mode) {
  const next = mode === "simple" ? "simple" : "full";
  if (next === MODE) return;
  MODE = next;
  UNITS = unitsFor(next);
  ZINFO = zinfoFor(next);
  CK = coinKeysFor(next);
  COIN_UNITS = coinUnitsFor(next);
  const fresh = createCoins(next);
  Object.keys(COINS).forEach(k => { if (!fresh[k]) delete COINS[k]; });
  Object.keys(fresh).forEach(k => { COINS[k] = fresh[k]; });
}
