export * from "@noxcat/shared/constants.js";
import { createCoins } from "@noxcat/shared/constants.js";

/* client 端自己的單例:一個瀏覽器分頁一份,由 engine.js 收到伺服器狀態時原地寫入。 */
export const COINS = createCoins();
