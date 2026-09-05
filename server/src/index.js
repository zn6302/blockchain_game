import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./rooms/ArenaRoom.js";

const httpServer = createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

/* filterBy(["code"]) 讓 join/joinOrCreate 只會配到「建立時 code 相同」的房間，
   房號配對就是靠這一行——沒有它 join 會隨便配到任何一間開著的房。 */
gameServer.define("arena", ArenaRoom).filterBy(["code"]);

const port = Number(process.env.PORT) || 2567;
gameServer.listen(port).then(() => {
  console.log(`Colyseus listening on ws://localhost:${port}`);
  const lanIps = Object.values(networkInterfaces())
    .flat()
    .filter(i => i && i.family === "IPv4" && !i.internal)
    .map(i => i.address);
  if (lanIps.length) {
    console.log("同一區網的裝置(手機等)可以連:");
    lanIps.forEach(ip => console.log(`  ws://${ip}:${port}`));
    console.log("記得 client 也要用 --host 開(react-app: npm run dev -- --host),");
    console.log("手機瀏覽器打開那個網址,前端會自動接去同一台機器的這個 port。");
  }
});
