import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./rooms/ArenaRoom.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* 前端 build 出來的靜態檔。同一個 process 既送網頁也開 WebSocket，
   所以線上只需要一個網址、一個 port——不用把前後端拆成兩個地方部署。
   容器裡前端會被複製到別的路徑，用 CLIENT_DIST 指過去。 */
const DIST = process.env.CLIENT_DIST || join(HERE, "../../react-app/dist");
const INDEX = join(DIST, "index.html");
const hasClient = existsSync(INDEX);

const httpServer = createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),

  /* Colyseus 自己的 express app（matchmake 路由就掛在上面），
     不要另外 createServer(myApp)——那會變成兩個 request listener 搶著回應。 */
  express: (app) => {
    app.get("/health", (req, res) => res.json({ ok: true }));

    if (!hasClient) return;
    app.use(express.static(DIST));
    /* SPA fallback：唯一要小心的是別把 Colyseus 的 /matchmake/* 吃掉。 */
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/matchmake")) return next();
      res.sendFile(INDEX);
    });
  },
});

/* filterBy(["code"]) 讓 join/joinOrCreate 只會配到「建立時 code 相同」的房間，
   房號配對就是靠這一行——沒有它 join 會隨便配到任何一間開著的房。 */
gameServer.define("arena", ArenaRoom).filterBy(["code"]);

const port = Number(process.env.PORT) || 2567;
gameServer.listen(port).then(() => {
  console.log(`Colyseus listening on port ${port}`);
  console.log(hasClient
    ? `前端已一起送出:直接開 http://localhost:${port}`
    : `(還沒 build 前端:npm run build,之後這個 port 就會一起送網頁)`);

  if (process.env.NODE_ENV === "production") return;
  const lanIps = Object.values(networkInterfaces())
    .flat()
    .filter(i => i && i.family === "IPv4" && !i.internal)
    .map(i => i.address);
  if (lanIps.length) {
    console.log("同一區網的裝置(手機等)可以連:");
    lanIps.forEach(ip => console.log(`  http://${ip}:${port}`));
  }
}).catch((err) => {
  console.error(`伺服器起不來(port ${port}):`, err && err.message ? err.message : err);
  process.exit(1);
});
