import { S } from "./state.js";

/* ============================ 戰鬥特效 ============================ */
export function fxShot(a, b, col) { S.fx.push({ k: "shot", x1: a.x, y1: a.y - 8, x2: b.x, y2: b.y - 8, c: col, t: 0.13, life: 0.13 }); }
export function fxHit(x, y, col) { S.fx.push({ k: "hit", x, y: y - 8, c: col, t: 0.24, life: 0.24 }); }
export function fxDmg(x, y, v, mine) { S.fx.push({ k: "dmg", x, y: y - 16, v: Math.max(1, Math.round(v)), mine, t: 0.85, life: 0.85 }); }
export function fxKill(x, y, col) { S.fx.push({ k: "kill", x, y: y - 8, c: col, t: 0.5, life: 0.5 }); }
export function fxCoin(x, y, txt, col) { S.fx.push({ k: "coin", x: x + (Math.random() * 10 - 5), y: y - 14, txt, c: col, t: 1.05, life: 1.05 }); }
