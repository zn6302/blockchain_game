import { SPRITES } from "./sprites.js";
import { UNITS, COINS, ZINFO, PLAYER_COLORS, PCOL, SPR_OF } from "./constants.js";
import { ZONES, HEXR, KY, hexXY, isoPts, tileSVG, PS } from "@noxcat/shared/board.js";
import { S, clamp, sizeMul } from "./state.js";

/* ---------------- 場景帶（前景遮擋） ---------------- */
const BAND = 15;                                    // 每條場景帶的高度（px）

/* ---------------- camera (zoom / pan) ---------------- */
const VBW = 940, VBH = 640;

const MAPB = (() => {                                   // 地圖的實際世界範圍
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  ZONES.forEach(z => {
    const { x, y } = hexXY(z[0], z[1]);
    x0 = Math.min(x0, x - HEXR); x1 = Math.max(x1, x + HEXR);
    y0 = Math.min(y0, y - HEXR * 0.9); y1 = Math.max(y1, y + HEXR * 0.9 + 30);
  });
  return { x0, y0, x1, y1 };
})();
export function fitView() { return { x: (MAPB.x0 + MAPB.x1) / 2, y: (MAPB.y0 + MAPB.y1) / 2, z: 1 }; }
export function homeView(myIndex) {
  const b = ZONES.find(z => z[2] === "base" && z[3] === (myIndex ?? 0));
  const { x, y } = hexXY(b[0], b[1]);
  return { x: x + 40, y: y + 18, z: window.innerWidth < 900 ? 1.6 : 1.75 };
}

/* ---------------- pixel tooltip (pure canvas raster, no page DOM) ---------------- */
const tipCache = new Map();
function pixelText(text, weight, size, family, color, track) {
  track = track || 0;
  const c = document.createElement("canvas"), m = c.getContext("2d");
  const font = `${weight} ${size}px ${family}`;
  m.font = font;
  const chars = [...text];
  const cw = chars.map(ch => Math.ceil(m.measureText(ch).width));
  const w = Math.max(1, cw.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1) + 2);
  const h = Math.ceil(size * 1.45) + 2;
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.font = font; g.textBaseline = "top"; g.fillStyle = color;
  let cx = 1; chars.forEach((ch, i) => { g.fillText(ch, cx, 1); cx += cw[i] + track; });
  const im = g.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] > 92 ? 255 : 0;    // 去除消鋸齒 → 硬邊像素
  g.putImageData(im, 0, 0);
  return { url: c.toDataURL(), w, h };
}

/* ---------------- 大招特效 ----------------
   伺服器只廣播「誰、在哪一格、放了哪一招」(fx 的 k:"ult"),長什麼樣子完全由這裡決定。
   跟其他 fx 一樣是每個 frame 重畫的字串,沒有 CSS animation——因為每一發都有自己的
   進度 (f.t/f.life),用 CSS 就得替每一發生一個節點再等它自己結束,反而更難收乾淨。
   四招的畫面刻意各走各的形狀,瞄一眼就分得出來是哪一招：
     定期定額 = 定速落下的硬幣（節奏）  鎖倉 = 扣上去的六角護盾（封住）
     ALL-IN  = 往外炸的震波與裂縫（衝擊）內線 = 往外掃的雷達（範圍）
   pr 是 0→1 的進度,k 是 1→0 的剩餘量（拿來當淡出用）。 */
function isoRing(x, y, r, col, op, w, extra) {
  return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * KY).toFixed(1)}"
    fill="none" stroke="${col}" stroke-width="${w.toFixed(1)}" opacity="${op.toFixed(2)}" ${extra || ""}/>`;
}
function hexRing(x, y, f, col, op, w) {
  return `<polygon points="${PS(isoPts(x, y, f))}" fill="none" stroke="${col}"
    stroke-width="${w.toFixed(1)}" stroke-linejoin="round" opacity="${op.toFixed(2)}"/>`;
}
function coinGlyph(x, y, col, op, r) {
  if (op <= 0.02) return "";
  return `<g opacity="${op.toFixed(2)}">
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${col}"/>
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="none" stroke="#0A0F0A" stroke-width="1.1"/>
    <ellipse cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.34).toFixed(1)}"
      rx="${(r * 0.33).toFixed(1)}" ry="${(r * 0.28).toFixed(1)}" fill="#FFFFFF" opacity=".55"/></g>`;
}

const ULT_FX = {
  /* 時鐘本體只由 drawDcaVisual 畫；這裡只保留它落地時的衝擊波，避免生成第二顆鐘。 */
  office(f, pr, _k) {
    let s = "";
    if (pr > .28) {
      const ip = clamp((pr - .28) / .5, 0, 1);
      s += isoRing(f.x, f.y + 5, 12 + ip * 76, f.c, (1 - ip) * .9, 4)
        + isoRing(f.x, f.y + 5, 7 + ip * 48, "#F2F7EE", (1 - ip) * .55, 2);
    }
    return s;
  },
  /* 鎖倉：護盾用的是地格本身的六角形,由小扣到滿格,看起來就是「這塊地被封起來」。
     外圈那條虛線一直在轉,12 秒內每隻貓身上的泡泡是另一段(drawUnits 畫的)。 */
  saver(f, pr, k) {
    const sc = 0.25 + clamp(pr / 0.3, 0, 1) * 0.85 + (1 - k) * 0.06;
    let s = `<polygon points="${PS(isoPts(f.x, f.y, sc))}" fill="${f.c}" opacity="${(k * 0.16).toFixed(2)}"/>`;
    s += hexRing(f.x, f.y, sc, f.c, k * 0.95, 3.4);
    s += hexRing(f.x, f.y, sc * 0.72, f.c, k * 0.5, 1.8);
    s += `<g transform="rotate(${(pr * 230).toFixed(1)} ${f.x.toFixed(1)} ${f.y.toFixed(1)})">`
      + isoRing(f.x, f.y, HEXR * sc * 0.9, f.c, k * 0.55, 1.6, 'stroke-dasharray="6 10"') + `</g>`;
    const ly = f.y - 26 - pr * 12, op = Math.min(1, pr * 5) * Math.min(1, k * 2.4);
    s += `<g opacity="${op.toFixed(2)}">
      <path d="M${(f.x - 5).toFixed(1)},${(ly - 2).toFixed(1)} a5,5.5 0 0 1 10,0"
        fill="none" stroke="${f.c}" stroke-width="2"/>
      <rect x="${(f.x - 7).toFixed(1)}" y="${(ly - 2).toFixed(1)}" width="14" height="11" rx="2" fill="${f.c}"/>
      <circle cx="${f.x.toFixed(1)}" cy="${(ly + 3.5).toFixed(1)}" r="1.8" fill="#0A0F0A"/></g>`;
    return s;
  },
  /* ALL-IN：巨獸砸下來。三圈震波錯開往外炸 + 放射狀裂縫 + 中心一下白光。
     鏡頭的晃動不在這裡——那是 engine 收到事件時叫 mapView.shake()。 */
  degen(f, pr, k) {
    let s = "";
    for (let i = 0; i < 3; i++) {
      const lp = clamp((pr - i * 0.13) / 0.62, 0, 1);
      if (lp <= 0) continue;
      const e = 1 - Math.pow(1 - lp, 3);                  // 一開始衝很快,尾巴慢慢停
      s += hexRing(f.x, f.y, 0.3 + e * 2.1, f.c, (1 - lp) * 0.9, 4.2 - i * 1.1);
    }
    const w = clamp(k * 1.4, 0, 1);
    for (let i = 0; i < 11; i++) {
      const a = i * 0.571 + 0.2, d0 = 14 + pr * 96;
      s += `<line x1="${(f.x + Math.cos(a) * 12).toFixed(1)}" y1="${(f.y + Math.sin(a) * 12 * KY).toFixed(1)}"
        x2="${(f.x + Math.cos(a) * d0).toFixed(1)}" y2="${(f.y + Math.sin(a) * d0 * KY).toFixed(1)}"
        stroke="${f.c}" stroke-width="${(1 + w * 2.4).toFixed(1)}"
        opacity="${(w * 0.85).toFixed(2)}" stroke-linecap="round"/>`;
    }
    const flash = clamp(pr / 0.18, 0, 1), fr = 24 + pr * 30;
    s += `<ellipse cx="${f.x.toFixed(1)}" cy="${f.y.toFixed(1)}" rx="${fr.toFixed(1)}"
      ry="${(fr * KY).toFixed(1)}" fill="#FFF6E2" opacity="${((1 - flash) * 0.85).toFixed(2)}"/>`;
    return s;
  },
  /* 內線消息：從基地往外掃一圈的雷達。它沒有打到任何人,給的是「你先看到了」,
     所以環走得比誰都遠,掃描線帶一截殘影表示它在轉。 */
  insider(f, pr, k) {
    let s = "";
    for (let i = 0; i < 3; i++) {
      const lp = clamp((pr - i * 0.16) / 0.7, 0, 1);
      if (lp <= 0) continue;
      s += isoRing(f.x, f.y, 16 + lp * 215, f.c, (1 - lp) * 0.55, 2.2);
    }
    const a0 = -Math.PI / 2 + pr * Math.PI * 3.2;
    for (let i = 0; i < 5; i++) {
      const a = a0 - i * 0.14;
      s += `<line x1="${f.x.toFixed(1)}" y1="${f.y.toFixed(1)}"
        x2="${(f.x + Math.cos(a) * 120).toFixed(1)}" y2="${(f.y + Math.sin(a) * 120 * KY).toFixed(1)}"
        stroke="${f.c}" stroke-width="2" opacity="${(k * 0.5 * (1 - i / 5)).toFixed(2)}" stroke-linecap="round"/>`;
    }
    const ey = f.y - 34, op = Math.min(1, pr * 4) * Math.min(1, k * 2.2);
    s += `<g opacity="${op.toFixed(2)}">
      <path d="M${(f.x - 15).toFixed(1)},${ey.toFixed(1)} q15,-13 30,0 q-15,13 -30,0"
        fill="#0A0F0A" stroke="${f.c}" stroke-width="1.8"/>
      <circle cx="${f.x.toFixed(1)}" cy="${ey.toFixed(1)}" r="4.6" fill="${f.c}"/>
      <circle cx="${(f.x + 1.4).toFixed(1)}" cy="${(ey - 1.4).toFixed(1)}" r="1.6" fill="#0A0F0A"/></g>`;
    return s;
  },
  /* 定期定額進行中,每買一隻就打一個小脈衝——那 24 秒裡機器一直在動,要看得見。 */
  dca(f, pr, k) {
    return isoRing(f.x, f.y + 4, 6 + pr * 26, f.c, k * 0.7, 2)
      + coinGlyph(f.x, f.y - 4 - pr * 18, f.c, Math.min(1, k * 1.6), 4.4);
  },
};

/* 發動落地動畫結束後，時鐘仍懸在基地上方倒數。這只讀本地視覺狀態。 */
function drawDcaVisual(now) {
  let s = "";
  Object.entries(S.dcaVisual).forEach(([pi, v]) => {
    const left = (v.until - now) / 1000;
    if (left <= 0) { delete S.dcaVisual[pi]; return; }
    const elapsed = now - v.startedAt, land = clamp(elapsed / 510, 0, 1);
    const ease = 1 - Math.pow(1 - land, 3), restingY = v.y - 42;
    const cy = restingY - (1 - ease) * 155 + (land >= 1 ? Math.sin(now / 420) * 1.5 : 0);
    const squash = land >= 1 && elapsed < 720 ? 1 + Math.sin((elapsed - 510) / 210 * Math.PI) * .1 : 1;
    const pulse = (1 + Math.sin(now / 180) * .025) * squash;
    const minuteA = (24 - left) / 24 * Math.PI * 2 - Math.PI / 2;
    const hourA = (24 - left) / 24 * Math.PI / 3 - Math.PI / 2;
    const col = PLAYER_COLORS[+pi] || "#91D500";
    s += `<g transform="translate(${v.x.toFixed(1)} ${cy.toFixed(1)}) scale(${(2 - pulse).toFixed(3)} ${pulse.toFixed(3)})" pointer-events="none">
      <ellipse cy="23" rx="17" ry="4.5" fill="${col}" opacity=".08"/>
      <circle r="18" fill="${col}" opacity=".82"/>
      <circle r="15.3" fill="#132014" opacity=".96"/>
      <line x2="${(Math.cos(hourA) * 8).toFixed(1)}" y2="${(Math.sin(hourA) * 8).toFixed(1)}" stroke="#F2F7EE" stroke-width="2.3" stroke-linecap="round"/>
      <line x2="${(Math.cos(minuteA) * 12).toFixed(1)}" y2="${(Math.sin(minuteA) * 12).toFixed(1)}" stroke="${col}" stroke-width="1.7" stroke-linecap="round"/>
      <circle r="1.8" fill="#F2F7EE"/></g>`;
  });
  return s;
}

const NS = "http://www.w3.org/2000/svg";

/**
 * 建立一個綁定到單一 <svg id="map"> 節點的地圖引擎實體。
 * 把原本整份 IIFE 裡「戰場」相關的模組層級可變狀態（CAM/PROPS/BANDS/UNODES/tipCache 之外的 uframe）
 * 收進這個 factory 的 closure，一場遊戲一個實體。
 */
export function createMapView(svgEl) {
  const $ = (sel) => svgEl.querySelector(sel);
  const CAM = { x: VBW / 2, y: VBH / 2, z: 1 };
  const PROPS = [];
  const BANDS = { min: 0, n: 1, el: [], cache: [] };
  const UNODES = new Map();
  let uframe = 0;

  function bandOf(y) { return clamp(Math.floor((y - BANDS.min) / BAND), 0, BANDS.n - 1); }

  /* 鏡頭震動（目前只有巨獸落地會用）。偏移是加在輸出的 viewBox 上,不動 CAM 本身——
     CAM 是玩家自己的視角,震完得原封不動回到原位;把偏移寫進 CAM,連續兩發就會把
     鏡頭一路推走。clampCam 也因此不必知道有這回事。 */
  let shk = null, shkRaf = 0, shkX = 0, shkY = 0;
  function applyCam() {
    const w = VBW / CAM.z, h = VBH / CAM.z;
    svgEl.setAttribute("viewBox", `${(CAM.x + shkX - w / 2).toFixed(1)} ${(CAM.y + shkY - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  }
  function shake(amp, ms) {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const now = performance.now();
    /* 同時來兩隻巨獸就取比較大的那一發,不要疊加成失控的抖動。 */
    shk = { amp: Math.max(amp, (shk && shk.end > now) ? shk.amp : 0), end: now + ms, dur: ms };
    if (shkRaf) return;
    const step = (t) => {
      if (!shk || t >= shk.end) { shk = null; shkRaf = 0; shkX = shkY = 0; applyCam(); return; }
      const d = Math.pow((shk.end - t) / shk.dur, 2);          // 越震越小
      shkX = (Math.random() * 2 - 1) * shk.amp * d;
      shkY = (Math.random() * 2 - 1) * shk.amp * d * KY;
      applyCam();
      shkRaf = requestAnimationFrame(step);
    };
    shkRaf = requestAnimationFrame(step);
  }
  function viewSize() {                                // slice 之後實際看得到的世界範圍
    const r = svgEl.getBoundingClientRect(), vw = VBW / CAM.z, vh = VBH / CAM.z;
    const sc = Math.max(r.width / vw, r.height / vh);
    return { w: r.width / sc, h: r.height / sc };
  }
  function uiPad(sel, extra) {                       // 被介面蓋住的高度，換算成世界單位
    const el = document.querySelector(sel);
    if (!el) return 0;
    const r = svgEl.getBoundingClientRect(); if (!r.height) return 0;
    return (el.getBoundingClientRect().height + (extra || 0)) * (viewSize().h / r.height);
  }
  function clampCam() {
    CAM.z = Math.max(0.6, Math.min(2.8, CAM.z));
    const v = viewSize(), pad = 40;
    const cx = (MAPB.x0 + MAPB.x1) / 2, cy = (MAPB.y0 + MAPB.y1) / 2;
    const lx0 = MAPB.x0 + v.w / 2 - pad, lx1 = MAPB.x1 - v.w / 2 + pad;
    const ly0 = MAPB.y0 + v.h / 2 - pad - uiPad(".toast", 16);      // 上面被提示條蓋住
    const ly1 = MAPB.y1 - v.h / 2 + pad + uiPad(".dock", 24);       // 下面被操作列蓋住
    CAM.x = lx0 > lx1 ? cx : Math.max(lx0, Math.min(lx1, CAM.x));
    CAM.y = ly0 > ly1 ? cy : Math.max(ly0, Math.min(ly1, CAM.y));
  }
  function animateTo(t, ms) {
    const s0 = { x: CAM.x, y: CAM.y, z: CAM.z }, t0 = performance.now();
    const red = matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (red || ms <= 0) { Object.assign(CAM, t); clampCam(); applyCam(); return; }
    (function step(now) {
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      CAM.x = s0.x + (t.x - s0.x) * e; CAM.y = s0.y + (t.y - s0.y) * e; CAM.z = s0.z + (t.z - s0.z) * e;
      clampCam(); applyCam();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function svgScale() {
    const r = svgEl.getBoundingClientRect();
    return Math.max(r.width / (VBW / CAM.z), r.height / (VBH / CAM.z));
  }

  function showTip(idx) {
    const tip = $("#tip");
    const [q, r, type, owner] = ZONES[idx], z = ZINFO[type], { x, y } = hexXY(q, r);
    let t = tipCache.get(idx);
    if (!t) {
      const name = type === "base" ? `${z.t} P${owner + 1}` : z.t;
      const sub = z.coin ? `+$${z.yield}/s ${z.coin}` : z.s;
      const col = z.coin ? COINS[z.coin].hex : (type === "base" ? PLAYER_COLORS[owner] : "#9FB79A");
      t = {
        n: pixelText(name, 900, 15, '"Noto Sans TC",sans-serif', "#F2F7EE", 3),
        s: pixelText(sub, 400, 8, '"Press Start 2P",monospace', col, 1),
        edge: type === "base" ? PLAYER_COLORS[owner] : "#91D500"
      };
      tipCache.set(idx, t);
    }
    const K = Math.max(0.3, 0.62 / CAM.z), padX = 8 * K, padY = 7 * K, gap = 8 * K;
    const nw = t.n.w * K, nh = t.n.h * K, sw = t.s.w * K, sh = t.s.h * K;
    const w = Math.max(nw, sw) + padX * 2, h = nh + gap + sh + padY * 2;
    const X = -w / 2, Y = -h;
    const set = (id, a) => { const e = $(id); for (const k in a) e.setAttribute(k, a[k]); };
    set("#tipShadow", { x: X + 5, y: Y + 5, width: w, height: h });
    set("#tipEdge", { x: X, y: Y, width: w, height: h, fill: t.edge });
    set("#tipBg", { x: X + 3, y: Y + 3, width: w - 6, height: h - 6 });
    set("#tipName", { href: t.n.url, x: -nw / 2, y: Y + padY, width: nw, height: nh });
    set("#tipSub", { href: t.s.url, x: -sw / 2, y: Y + padY + nh + gap, width: sw, height: sh });
    tip.setAttribute("transform", `translate(${x.toFixed(1)},${(y - HEXR * KY - 8).toFixed(1)})`);
    tip.style.display = "";
  }
  function hideTip() { const tip = $("#tip"); if (tip) tip.style.display = "none"; }

  function render() {
    const order = ZONES.map((z, i) => i).sort((i1, i2) => {
      const A = ZONES[i1], B = ZONES[i2];
      return (A[1] - B[1]) || (A[0] - B[0]);
    });
    const front = order.filter(i => ZONES[i][2] === "exchange");        // 交易所的地塊最後畫，蓋在別塊上面
    const rest = order.filter(i => ZONES[i][2] !== "exchange");
    const tiles = rest.concat(front).map(idx => tileSVG(idx, S.myIndex ?? 0));
    let s = tiles.map(t => t.g).join("");
    PROPS.length = 0;
    tiles.forEach(t => t.props.forEach(pr => PROPS.push(pr)));
    PROPS.sort((a, b) => a.y - b.y);
    s += '<g id="labelLayer" style="pointer-events:none">';
    ZONES.forEach(([q, r, type, owner], idx) => {
      if (type !== "base") return;
      const { x, y } = hexXY(q, r), ly = y - HEXR * KY - 14;
      const me = owner === (S.myIndex ?? 0);
      const myCol = PLAYER_COLORS[S.myIndex ?? 0];
      if (me) {
        const cy = y + 6, mt = `matrix(1,0,0,${KY},0,${(cy * (1 - KY)).toFixed(1)})`;
        s += `<ellipse cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(HEXR * 0.86).toFixed(1)}"
              ry="${(HEXR * 0.86 * KY).toFixed(1)}" fill="${myCol}" opacity=".10"/>`;
        s += `<g class="youring"><circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(HEXR * 0.66).toFixed(1)}"
              fill="none" stroke="${myCol}" stroke-width="3" transform="${mt}"/></g>`;
        s += `<g class="youspin"><circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(HEXR * 0.52).toFixed(1)}"
              fill="none" stroke="${myCol}" stroke-width="1.6" stroke-dasharray="7 9"
              opacity=".7" transform="${mt}"/></g>`;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const bx = x + sx * HEXR * 0.74, by = cy + sy * HEXR * 0.5 * KY;
          s += `<path d="M${(bx - sx * 10).toFixed(1)},${by.toFixed(1)} L${bx.toFixed(1)},${by.toFixed(1)} L${bx.toFixed(1)},${(by - sy * 7).toFixed(1)}"
                fill="none" stroke="${myCol}" stroke-width="2.4" opacity=".85"/>`;
        }
        s += `<g class="youbob"><path d="M${x.toFixed(1)},${(y - HEXR * KY - 24).toFixed(1)}
              l-8,-11 l16,0 Z" fill="${myCol}"/></g>`;
      }
      s += `<text class="basetag" x="${x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle"
            fill="${PLAYER_COLORS[owner]}">${me ? `YOU  P${owner + 1}` : "P" + (owner + 1)}</text>`;
    });
    s += '</g><g id="zoneFx" style="pointer-events:none"></g>';
    // 前景與角色交錯：把場景切成一條條水平帶，角色插進對應的帶裡，
    // 站在樹／山／房子上方的角色會被前景擋住。
    BANDS.min = Math.floor(PROPS.length ? PROPS[0].y : 0) - BAND;
    BANDS.n = Math.ceil(((PROPS.length ? PROPS[PROPS.length - 1].y : 0) - BANDS.min) / BAND) + 2;
    const buckets = Array.from({ length: BANDS.n }, () => "");
    PROPS.forEach(pr => { buckets[bandOf(pr.y)] += pr.s; });
    s += '<g id="scene">';
    for (let i = 0; i < BANDS.n; i++)
      s += `<g class="pb" style="pointer-events:none">${buckets[i]}</g><g class="ub" id="ub${i}"></g>`;
    s += '</g><g id="unitLayer" style="pointer-events:none"></g>'
      + '<g id="fxLayer" style="pointer-events:none"></g>'
      + `<g id="tip" style="display:none;pointer-events:none">
          <rect id="tipShadow" fill="#050805" opacity=".55"/>
          <rect id="tipEdge"/>
          <rect id="tipBg" fill="#0A0F0A"/>
          <image id="tipName" image-rendering="pixelated"/>
          <image id="tipSub" image-rendering="pixelated"/>
        </g>`;
    svgEl.innerHTML = s;
    BANDS.el = [...svgEl.querySelectorAll(".ub")];
    BANDS.cache = BANDS.el.map(() => "");
    const tip = $("#tip");
    svgEl.querySelectorAll(".hex").forEach(g => {
      g.onmouseenter = () => showTip(+g.dataset.z);
      g.onmouseleave = () => { tip.style.display = "none"; };
    });
  }

  function makeNode(u) {
    const d = UNITS[u.k], ch = COINS[u.coin], c = PLAYER_COLORS[u.p], mine = u.p === S.myIndex;
    const sk = SPR_OF[u.k] || u.k, sp = SPRITES[sk], box = sp.box;
    const H = (u.k === "titan" ? 52 : 30), W = H * (box[0] + 2) / (box[1] + 2), bw = Math.max(16, W * 0.72);
    const g = document.createElementNS(NS, "g");
    g.setAttribute("data-uid", u.id);
    g.innerHTML = `<g class="sc">
      <ellipse cx="1" cy="3" rx="${(W * 0.42).toFixed(1)}" ry="${(W * 0.16).toFixed(1)}" fill="#0E241D" opacity=".55"/>
      <ellipse cx="0" cy="3" rx="${(W * 0.5).toFixed(1)}" ry="${(W * 0.2).toFixed(1)}" fill="${c}" opacity="${mine ? .3 : .22}"/>
      <g class="fl"><image x="${(-W / 2).toFixed(1)}" y="${(-H + 4).toFixed(1)}" width="${W.toFixed(1)}" height="${H}"/></g>
      <rect class="hf" x="${(-W / 2).toFixed(1)}" y="${(-H + 4).toFixed(1)}" width="${W.toFixed(1)}" height="${H}"
        fill="#FFFFFF" opacity="0" style="display:none"/></g>`;
    const ui = document.createElementNS(NS, "g");
    ui.innerHTML = `<circle class="cb" cy="-2" r="${(W * 0.62).toFixed(1)}" fill="none" stroke="#F2555A" stroke-width="1.6" opacity=".8" style="display:none"/>
      <circle class="se" cy="-2" r="${(W * 0.72).toFixed(1)}" fill="none" stroke="#F2F7EE" stroke-width="1.8" stroke-dasharray="4 4" style="display:none"/>
      <circle class="mn" cy="0" fill="none" stroke="${ch.hex}" stroke-width="1.6" style="display:none"/>
      <rect x="${(-bw / 2).toFixed(1)}" y="${(-H - 1).toFixed(1)}" width="${bw.toFixed(1)}" height="2.6" rx="1.3" fill="rgba(6,14,9,.85)"/>
      <rect class="hp" x="${(-bw / 2).toFixed(1)}" y="${(-H - 1).toFixed(1)}" width="${bw.toFixed(1)}" height="2.6" rx="1.3" fill="${c}"/>
      <circle cx="${(bw / 2 + 3.5).toFixed(1)}" cy="${(-H + 0.3).toFixed(1)}" r="2.6" fill="${ch.hex}" stroke="#0A0F0A" stroke-width=".8"/>
      ${mine ? `<g class="plg" style="display:none"><rect class="mbg" x="-19" y="${(-H - 15).toFixed(1)}" width="38" height="13" rx="6.5"/>
        <text class="plbig" y="${(-H - 5.5).toFixed(1)}"></text></g>
        <text class="plmark" y="${(-H - 5).toFixed(1)}"></text>` : ""}
      <g class="dcaura" style="display:none" pointer-events="none"></g>
      <g class="shd" style="display:none" pointer-events="none">
        <path class="shb" fill="${c}" opacity=".3"/>
        <path class="shr" fill="none" stroke="${c}" stroke-width="1.15" stroke-linejoin="round" opacity=".72"/>
        <path class="shl" fill="none" stroke="#FFFFFF" stroke-width="1" opacity=".38"/>
      </g>`;
    const n = {
      g, ui, sc: g.querySelector(".sc"), fl: g.querySelector(".fl"), img: g.querySelector("image"), hf: g.querySelector(".hf"),
      cb: ui.querySelector(".cb"), se: ui.querySelector(".se"), mn: ui.querySelector(".mn"),
      hp: ui.querySelector(".hp"), mark: ui.querySelector(".plmark"),
      plg: ui.querySelector(".plg"), mbg: ui.querySelector(".mbg"), plb: ui.querySelector(".plbig"),
      dca: ui.querySelector(".dcaura"), shd: ui.querySelector(".shd"), shb: ui.querySelector(".shb"),
      shr: ui.querySelector(".shr"), shl: ui.querySelector(".shl"),
      W, H, bw, band: -1, href: "", face: 0, seen: 0, k: 0
    };
    const rr = ui.querySelectorAll("rect"); n.hpbg = rr[0];
    n.dot = ui.querySelectorAll("circle")[3] || null;
    UNODES.set(u.id, n);
    $("#unitLayer").appendChild(ui);
    return n;
  }

  function drawUnits() {
    if (!BANDS.el.length) return;
    const fr = Math.floor(performance.now() / 150) % 4;
    const tsec = performance.now() / 1000;
    uframe++;
    S.units.forEach(u => {
      if (!u.alive) return;
      const n = UNODES.get(u.id) || makeNode(u);
      n.seen = uframe;
      const ch = COINS[u.coin];
      const hit = u.hitT > 0 ? u.hitT / 0.2 : 0;
      const sx = hit ? (Math.random() - 0.5) * 4.5 : 0, sy = hit ? (Math.random() - 0.5) * 3 : 0;
      const T = `translate(${(u.x + sx).toFixed(1)},${(u.y + sy).toFixed(1)})`;
      n.g.setAttribute("transform", T); n.ui.setAttribute("transform", T);
      // 走路動畫
      const sk = SPR_OF[u.k] || u.k;
      const moving = (u.combatT > 0 || u.mineFx > 0 || u.moved > 0.4);
      const href = SPRITES[sk][PCOL[u.p]][moving ? fr : 0];
      if (href !== n.href) { n.href = href; n.img.setAttribute("href", href); }
      const face = u.face || 1;
      if (face !== n.face) { n.face = face; n.fl.setAttribute("transform", `scale(${face},1)`); }
      // 幣價越高，貓越大隻（腳底對齊地面）
      const k = +sizeMul(u).toFixed(2);
      if (k !== n.k) {
        n.k = k;
        n.sc.setAttribute("transform", `translate(0,4) scale(${k}) translate(0,-4)`);
        const top = -(n.H * k) + 4 - 5;
        n.hpbg.setAttribute("y", top.toFixed(1)); n.hp.setAttribute("y", top.toFixed(1));
        if (n.dot) n.dot.setAttribute("cy", (top + 1.3).toFixed(1));
        if (n.mark) n.mark.setAttribute("y", (top - 4).toFixed(1));
        if (n.plg) {
          n.plg.querySelector("rect").setAttribute("y", (top - 14).toFixed(1));
          n.plb.setAttribute("y", (top - 4.5).toFixed(1));
        }
        n.cb.setAttribute("r", (n.W * 0.62 * Math.max(1, k)).toFixed(1));
        n.se.setAttribute("r", (n.W * 0.72 * Math.max(1, k)).toFixed(1));
      }
      // 受擊閃白
      if (hit > 0) { n.hf.style.display = ""; n.hf.setAttribute("opacity", (hit * 0.45).toFixed(2)); }
      else if (n.hf.style.display !== "none") n.hf.style.display = "none";
      // 交戰狀態由攻擊線、受擊閃光與傷害數字表達，不再顯示出戲的紅色圓圈。
      n.cb.style.display = "none";
      n.se.style.display = (S.selU === u.id) ? "" : "none";
      if (u.mineFx > 0) {
        n.mn.style.display = ""; n.mn.setAttribute("r", (n.W * 0.5 + (0.55 - u.mineFx) * 16).toFixed(1));
        n.mn.setAttribute("opacity", (u.mineFx / 0.55 * 0.7).toFixed(2));
      }
      else if (n.mn.style.display !== "none") n.mn.style.display = "none";
      /* 定期定額期間，礦工身邊持續有像增益藥水的螺旋資金粒子。 */
      const dca = S.dcaVisual[u.p], dcaOn = u.k === "miner" && dca && dca.until > performance.now();
      if (dcaOn) {
        const phase = tsec * 2.1 + u.id * .73, rr = n.W * .48 * Math.max(1, n.k);
        const ah = n.H * .68 * Math.max(1, n.k);
        const pcol = PLAYER_COLORS[u.p] || "#91D500";
        /* Soft Aura：光從腳底聚集，再以柔軟、尖端收束的能量絲帶往上竄。
           同一批形狀疊一層模糊外光和一層較清楚的內芯，避免變成光圈或實心圓柱。 */
        let wisps = "";
        for (let i = 0; i < 9; i++) {
          const q = i / 8, x0 = (q * 2 - 1) * rr * .67;
          const ph = phase + i * 1.17, h = ah * (.48 + (i % 4) * .13 + Math.sin(ph) * .06);
          const inward = -x0 * .4, bend = Math.sin(ph * .83) * rr * .14;
          const tipX = x0 + inward + bend, w = rr * (.075 + (i % 3) * .018);
          const d = `M${(x0 - w).toFixed(1)},2 C${(x0 - w * .7).toFixed(1)},${(-h * .3).toFixed(1)} ${(tipX - bend * .35 - w * .35).toFixed(1)},${(-h * .72).toFixed(1)} ${tipX.toFixed(1)},${(-h).toFixed(1)} C${(tipX + bend * .18 + w * .32).toFixed(1)},${(-h * .7).toFixed(1)} ${(x0 + w * .75).toFixed(1)},${(-h * .27).toFixed(1)} ${(x0 + w).toFixed(1)},2 Z`;
          wisps += `<path d="${d}" fill="${i % 3 === 1 ? "#F2F7EE" : pcol}" opacity="${(.28 + (i % 3) * .045).toFixed(2)}"/>`;
        }
        const bubbleR = Math.max(n.W * .58, n.H * .52) * Math.max(1, n.k);
        const bubbleY = -n.H * .39 * Math.max(1, n.k), breathe = 1 + Math.sin(phase * .72) * .025;
        let aura = `<g transform="translate(0 ${bubbleY.toFixed(1)}) scale(${breathe.toFixed(3)})">
            <circle r="${bubbleR.toFixed(1)}" fill="${pcol}" opacity=".14"/>
            <circle r="${bubbleR.toFixed(1)}" fill="none" stroke="${pcol}" stroke-width="1.25" opacity=".58" style="filter:blur(.7px)"/>
            <ellipse cx="${(-bubbleR * .3).toFixed(1)}" cy="${(-bubbleR * .34).toFixed(1)}"
              rx="${(bubbleR * .24).toFixed(1)}" ry="${(bubbleR * .13).toFixed(1)}" fill="#F2FFD3" opacity=".24" transform="rotate(-32)"/>
          </g>
          <g style="filter:blur(5px)" opacity=".64">${wisps}</g>
          <g style="filter:blur(.35px)" opacity=".98">${wisps}</g>`;
        n.dca.innerHTML = aura; n.dca.style.display = "";
      } else if (n.dca.style.display !== "none") n.dca.style.display = "none";
      /* 鎖倉期間，每隻貓的正前方展開半透明盾牌；盾牌會跟著角色面向換邊。 */
      const lockT = (S.players[u.p] || {}).lockT || 0;
      if (lockT > 0) {
        const sw = n.W * 1.12 * Math.max(1, n.k), sh = n.H * 1.02 * Math.max(1, n.k);
        const pulse = 1 + Math.sin(tsec * 5 + u.id) * .025;
        const d = `M0,${(-sh / 2).toFixed(1)} L${(sw / 2).toFixed(1)},${(-sh * .28).toFixed(1)} L${(sw * .4).toFixed(1)},${(sh * .26).toFixed(1)} L0,${(sh / 2).toFixed(1)} L${(-sw * .4).toFixed(1)},${(sh * .26).toFixed(1)} L${(-sw / 2).toFixed(1)},${(-sh * .28).toFixed(1)} Z`;
        n.shd.style.display = "";
        n.shd.setAttribute("opacity", Math.min(1, lockT / 1.2).toFixed(2));
        n.shd.setAttribute("transform", `translate(0,${(-n.H * .4).toFixed(1)}) scale(${pulse.toFixed(3)})`);
        n.shb.setAttribute("d", d); n.shr.setAttribute("d", d);
        n.shl.setAttribute("d", `M${(-sw * .27).toFixed(1)},${(-sh * .21).toFixed(1)} L0,${(-sh * .34).toFixed(1)} L${(sw * .27).toFixed(1)},${(-sh * .21).toFixed(1)}`);
      } else if (n.shd.style.display !== "none") n.shd.style.display = "none";
      n.hp.setAttribute("width", (n.bw * Math.max(0, u.hp / u.hpMax)).toFixed(1));
      if (n.mark) {
        const r = ch.price <= 0.002 ? 0 : ch.price / u.entry, up = r >= 1, pct = Math.round((r - 1) * 100);
        const big = Math.abs(pct) >= 12 || r === 0;                 // 漲跌夠大就跳出提示牌
        const t = r === 0 ? "0" : (up ? "▲" : "▼") + Math.abs(pct);
        if (n.mark.textContent !== t) {
          n.mark.textContent = t;
          n.mark.setAttribute("fill", r === 0 ? "#F2555A" : (up ? "#91D500" : "#F2555A"));
        }
        if (big !== n.big) {
          n.big = big;
          n.plg.style.display = big ? "" : "none";
          n.mark.style.display = big ? "none" : "";
        }
        if (big) {
          const txt = (r === 0 ? "歸零" : (pct > 0 ? "+" : "") + pct + "%");
          if (n.plb.textContent !== txt) {
            n.plb.textContent = txt;
            n.mbg.setAttribute("fill", pct > 0 ? "#91D500" : "#F2555A");
            n.plb.setAttribute("fill", pct > 0 ? "#0B1004" : "#FFF2F2");
            n.plg.setAttribute("class", "plg " + (pct > 0 ? "good" : "bad"));
          }
        }
      }
      // 依 y 換到對應的場景帶（決定被前景擋住與否）
      const b = bandOf(u.y);
      if (b !== n.band) { n.band = b; BANDS.el[b].appendChild(n.g); }
    });
    UNODES.forEach((n, id) => {
      if (n.seen === uframe) return;
      n.g.remove(); n.ui.remove(); UNODES.delete(id);
    });
  }

  function drawFx() {
    const l = $("#fxLayer"); if (!l) return;
    let s = drawDcaVisual(performance.now());
    S.fx.forEach(f => {
      const k = Math.max(0, f.t / f.life);
      if (f.k === "shot") {
        s += `<line x1="${f.x1.toFixed(1)}" y1="${f.y1.toFixed(1)}" x2="${f.x2.toFixed(1)}" y2="${f.y2.toFixed(1)}"
             stroke="${f.c}" stroke-width="${(1 + k * 1.6).toFixed(1)}" opacity="${(k * 0.85).toFixed(2)}"
             stroke-linecap="round"/>`;
      } else if (f.k === "hit") {
        const r = 5 + (1 - k) * 11;
        s += `<circle cx="${f.x.toFixed(1)}" cy="${f.y.toFixed(1)}" r="${r.toFixed(1)}" fill="none"
             stroke="${f.c}" stroke-width="2" opacity="${(k * 0.9).toFixed(2)}"/>`;
      } else if (f.k === "kill") {
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + f.x * 0.01, d0 = 6 + (1 - k) * 20;
          s += `<line x1="${(f.x + Math.cos(a) * 6).toFixed(1)}" y1="${(f.y + Math.sin(a) * 3).toFixed(1)}"
               x2="${(f.x + Math.cos(a) * d0).toFixed(1)}" y2="${(f.y + Math.sin(a) * d0 * 0.5).toFixed(1)}"
               stroke="${f.c}" stroke-width="2.2" opacity="${(k * 0.95).toFixed(2)}" stroke-linecap="round"/>`;
        }
      } else if (f.k === "coin") {
        const rise = (1 - k) * 26, cx = f.x, cy = f.y - rise, op = Math.min(1, k * 2.4);
        s += `<g opacity="${op.toFixed(2)}">
          <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="5.4" ry="5.4" fill="${f.c}"/>
          <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="5.4" ry="5.4" fill="none" stroke="#0A0F0A" stroke-width="1.1"/>
          <ellipse cx="${(cx - 1.6).toFixed(1)}" cy="${(cy - 1.8).toFixed(1)}" rx="1.8" ry="1.5" fill="#FFFFFF" opacity=".55"/>
          <text class="cointxt" x="${(cx + 8).toFixed(1)}" y="${(cy + 3.6).toFixed(1)}" fill="${f.c}"
            stroke="#050805" stroke-width="2.2" paint-order="stroke">${f.txt}</text></g>`;
      } else if (f.k === "dmg") {
        const rise = (1 - k) * 24;
        const mine = f.p === S.myIndex, blocked = f.v <= 0;
        const col = blocked ? "#4FD1C5" : (mine ? "#F2555A" : "#91D500");
        const txt = blocked ? "0" : (mine ? "-" : "") + f.v;   // 青色的 0 ＝ 鎖倉擋下來了
        s += `<text class="dmgtxt" x="${f.x.toFixed(1)}" y="${(f.y - rise).toFixed(1)}"
             fill="${col}" opacity="${Math.min(1, k * 2.2).toFixed(2)}"
             stroke="#050805" stroke-width="2.4" paint-order="stroke">${txt}</text>`;
      } else if (f.k === "ult") {
        const draw = ULT_FX[f.u];
        if (draw) s += draw(f, 1 - k, k);
      }
    });
    l.innerHTML = s;
  }
  function drawZoneFx() {
    const l = $("#zoneFx"); if (!l) return;
    const hot = [...new Set(S.units.filter(u => u.alive && u.combatT > 0).map(u => u.z))].sort();
    const key = hot.join(",");
    if (key === S.hot) return;
    S.hot = key;
    l.innerHTML = hot.map(i => {
      const [q, r] = ZONES[i], { x, y } = hexXY(q, r);
      return `<polygon class="hotzone" points="${PS(isoPts(x, y, 0.95))}" fill="none"
        stroke="#F2555A" stroke-width="3.4" stroke-linejoin="round"/>
        <polygon class="hotzone" points="${PS(isoPts(x, y, 0.86))}" fill="#F2555A" opacity=".08"/>`;
    }).join("");
  }

  let cleanupFns = [];
  function attachInteraction({ onSelectUnit } = {}) {
    const pts = new Map(); let lastDist = 0, moved = 0, sx = 0, sy = 0;
    const onDown = e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        moved = 0; sx = e.clientX; sy = e.clientY; svgEl.classList.add("drag");
        try { svgEl.setPointerCapture(e.pointerId); } catch (_) { }
      }
      if (pts.size === 2) { const a = [...pts.values()]; lastDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    };
    const onMove = e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (lastDist) { CAM.z *= d / lastDist; clampCam(); applyCam(); }
        lastDist = d; return;
      }
      const k = 1 / svgScale();
      CAM.x -= (e.clientX - prev.x) * k; CAM.y -= (e.clientY - prev.y) * k;
      moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
      clampCam(); applyCam();
    };
    const onUp = e => {
      pts.delete(e.pointerId); lastDist = 0; svgEl.classList.remove("drag");
    };
    const onWheel = e => {
      e.preventDefault();
      const r = svgEl.getBoundingClientRect(), sc = svgScale();
      const wx = CAM.x + (e.clientX - r.left - r.width / 2) / sc, wy = CAM.y + (e.clientY - r.top - r.height / 2) / sc;
      const before = CAM.z; CAM.z *= e.deltaY < 0 ? 1.055 : 0.948; clampCam();
      const f = 1 - before / CAM.z;
      CAM.x += (wx - CAM.x) * f; CAM.y += (wy - CAM.y) * f;
      clampCam(); applyCam();
    };
    const onResize = () => { clampCam(); applyCam(); };
    svgEl.addEventListener("pointerdown", onDown);
    svgEl.addEventListener("pointermove", onMove);
    svgEl.addEventListener("pointerup", onUp);
    svgEl.addEventListener("pointercancel", onUp);
    svgEl.addEventListener("wheel", onWheel, { passive: false });
    addEventListener("resize", onResize);

    const scene = $("#scene");
    const onScenePointerDown = (e) => {
      const g = e.target.closest("[data-uid]"); if (!g) return;
      const u = S.units.find(x => x.id === +g.dataset.uid && x.alive);
      if (!u || u.p !== 0) return;
      e.stopPropagation();
      onSelectUnit && onSelectUnit(u.id);
    };
    scene && scene.addEventListener("pointerdown", onScenePointerDown);

    cleanupFns.push(() => {
      svgEl.removeEventListener("pointerdown", onDown);
      svgEl.removeEventListener("pointermove", onMove);
      svgEl.removeEventListener("pointerup", onUp);
      svgEl.removeEventListener("pointercancel", onUp);
      svgEl.removeEventListener("wheel", onWheel);
      removeEventListener("resize", onResize);
      scene && scene.removeEventListener("pointerdown", onScenePointerDown);
    });
  }

  function zoomIn() { animateTo({ x: CAM.x, y: CAM.y, z: CAM.z * 1.16 }, 200); }
  function zoomOut() { animateTo({ x: CAM.x, y: CAM.y, z: CAM.z / 1.16 }, 200); }
  function home() { animateTo(homeView(S.myIndex), 420); }
  function focusOn(x, y) { animateTo({ x, y: y - 10, z: Math.max(CAM.z, 1.6) }, 320); }

  function destroy() {
    cleanupFns.forEach(fn => fn()); cleanupFns = [];
    if (shkRaf) cancelAnimationFrame(shkRaf);
    shkRaf = 0; shk = null; shkX = 0; shkY = 0;
  }

  return {
    render, attachInteraction, destroy,
    drawUnits, drawFx, drawZoneFx, shake,
    zoomIn, zoomOut, home, focusOn,
    animateTo, clampCam, applyCam,
    setInitialCamera() { Object.assign(CAM, homeView(S.myIndex)); clampCam(); applyCam(); },
    hideTip,
  };
}
