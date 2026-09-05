import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CounterRoom } from "./rooms/CounterRoom.js";

const httpServer = createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("counter", CounterRoom);

const port = Number(process.env.PORT) || 2567;
gameServer.listen(port).then(() => {
  console.log(`Colyseus listening on ws://localhost:${port}`);
});
