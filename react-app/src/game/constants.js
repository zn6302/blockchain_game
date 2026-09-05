export * from "@noxcat/shared/constants.js";
export { ZINFO } from "@noxcat/shared/board.js";
import { createCoins } from "@noxcat/shared/constants.js";

/* COINS 是「被原地寫入」的物件:engine.js 每次收到伺服器狀態都往裡面寫 price,
   而且 state.js 的 ctx 直接抓著這個物件的參考,所以整份 module 只建一次、不換掉。 */
export const COINS = createCoins();
