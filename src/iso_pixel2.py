import math
from PIL import Image, ImageDraw

OUT = "/home/claude/noxcat_tiles/"

# ---------------------------------------------------------------- palette
BG        = (17, 22, 20)

G_L       = (128, 194, 72)     # grass light
G_M       = (106, 173, 58)     # grass mid
G_D       = (83, 146, 49)      # grass dark
G_SH      = (62, 116, 40)      # grass shadow
G_DEEP    = (48, 94, 36)
G_SIDE    = [(74, 120, 48), (60, 100, 40), (48, 82, 33), (38, 66, 26)]
SOIL_SIDE = [(126, 96, 62), (104, 78, 50), (86, 64, 41), (68, 50, 32)]
ROCK_SIDE = [(104, 106, 96), (86, 88, 80), (70, 72, 65), (56, 58, 52)]

DIRT_L    = (176, 140, 94)
DIRT      = (146, 112, 74)
DIRT_D    = (112, 84, 55)

W_SHAL    = (118, 196, 188)
W_MID     = (74, 160, 172)
W_DEEP    = (46, 118, 140)
W_FOAM    = (214, 244, 238)
SAND      = (216, 200, 148)

R_L       = (206, 208, 198)
R_M       = (162, 165, 154)
R_D       = (116, 120, 110)
R_SH      = (82, 86, 78)
SNOW      = (244, 246, 238)

C_L       = (126, 192, 68)     # canopy light
C_M       = (86, 154, 52)
C_D       = (56, 114, 42)
C_O       = (38, 82, 32)
C_AUT     = (226, 178, 54)     # autumn accent
C_AUT_D   = (176, 124, 38)
PINE_L    = (96, 166, 84)
PINE_D    = (46, 106, 56)
TRUNK     = (96, 68, 44)
TRUNK_D   = (68, 48, 30)

WALL      = (240, 234, 216)
WALL_D    = (196, 188, 166)
ROOF      = (156, 110, 74)
ROOF_D    = (116, 78, 52)
ROOF_B    = (104, 164, 202)
ROOF_BD   = (72, 122, 158)
WOOD      = (128, 92, 58)

LIME      = (163, 230, 53)
LIME_D    = (110, 158, 34)

# ---------------------------------------------------------------- geometry
R      = 40.0
KY     = 0.56
DEPTH  = 22
STEP_X = math.sqrt(3) * R
STEP_Y = 1.5 * R * KY

MAPS = [
    "...GGFF...",
    "..GFFGMM..",
    ".GGWWGFMM.",
    ".GXWWGGGM.",
    "GGGWWGGFG.",
    ".GFGWWGXG.",
    "..GFFWWGG.",
    "...GGGWG..",
]
ELEV = {"G": 0, "F": 0, "M": 11, "X": 0, "W": -7}
HIGHLIGHT = {(4, 6), (6, 7)}

def hexpts(cx, cy, f=1.0):
    return [(round(cx + R * f * math.cos(math.radians(k * 60 - 90))),
             round(cy + R * f * math.sin(math.radians(k * 60 - 90)) * KY)) for k in range(6)]

def half_at(dy):
    hy = R * KY
    if abs(dy) <= hy / 2:
        return math.sqrt(3) / 2 * R
    t = (abs(dy) - hy / 2) / (hy / 2)
    return max(0.0, math.sqrt(3) / 2 * R * (1 - t))

def inhex(dx, dy, pad=1.0):
    return abs(dx) <= half_at(dy) - pad and abs(dy) <= R * KY - 0.5

class Rng:
    def __init__(self, seed):
        self.s = (seed * 2654435761) % 4294967291 + 12345
    def n(self, a, b=None):
        self.s = (self.s * 1103515245 + 12345) % 2147483648
        if b is None:
            return self.s % a
        return a + self.s % (b - a + 1)
    def pick(self, seq):
        return seq[self.n(len(seq))]

# ---------------------------------------------------------------- props
def contact_shadow(d, cx, cy, rx, ry, col):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=col)

def conifer(d, cx, cy, h, w, rng, autumn=False):
    cx, cy = round(cx), round(cy)
    contact_shadow(d, cx + 2, cy + 1, w // 2 + 1, max(1, w // 4), G_SH)
    d.rectangle([cx - 1, cy - 1, cx, cy + 2], fill=TRUNK_D)
    tiers = 3 if h > 13 else 2
    per = h // tiers
    top_light, mid, dark = (C_AUT, C_AUT_D, (140, 96, 30)) if autumn else (PINE_L, C_M, PINE_D)
    for t in range(tiers):
        base_y = cy - t * (per - 1)
        ww = int(w * (1 - 0.22 * t))
        for r in range(per + 2):
            f = (r + 1) / (per + 2)
            half = max(0, int(round(ww / 2 * f)))
            y = base_y - (per + 2) + r + 1
            d.line([(cx - half, y), (cx - 1, y)], fill=top_light)
            d.point((cx, y), fill=mid)
            d.line([(cx + 1, y), (cx + half, y)], fill=dark)
            d.point((cx + half, y), fill=C_O)
            d.point((cx - half, y), fill=C_O)
            if r == per + 1:
                d.line([(cx - half, y), (cx + half, y)], fill=C_O)

def broadleaf(d, cx, cy, s, rng, autumn=False):
    cx, cy = round(cx), round(cy)
    L, M, D = (C_AUT, C_AUT_D, (150, 100, 32)) if autumn else (C_L, C_M, C_D)
    contact_shadow(d, cx + 2, cy + 1, s + 1, max(1, s // 2), G_SH)
    d.rectangle([cx - 1, cy - 2, cx, cy + 1], fill=TRUNK)
    rows = [s - 3, s - 1, s, s, s - 1, s - 2, s - 4]
    top = cy - len(rows)
    for r, w in enumerate(rows):
        if w <= 0:
            continue
        y = top + r
        d.line([(cx - w, y), (cx + w, y)], fill=M)
        d.line([(cx + max(0, w - 2), y), (cx + w, y)], fill=D)
        if r < 3:
            d.line([(cx - w + 1, y), (cx - max(1, w // 2), y)], fill=L)
        if r == len(rows) - 1:
            d.line([(cx - w, y), (cx + w, y)], fill=C_O)
    d.point((cx - 1, top + 1), fill=L)

def peak(d, cx, base_y, h, w, rng, snow=True, bare=False):
    cx, base_y = round(cx), round(base_y)
    # talus / rubble skirt so the mass sits into the ground
    contact_shadow(d, cx + 3, base_y + 1, w // 2 + 4, max(2, w // 5), G_SH)
    for _ in range(w // 2):
        rx = cx + rng.n(-w // 2 - 4, w // 2 + 4)
        ry = base_y + rng.n(-2, 3)
        d.point((rx, ry), fill=rng.pick([R_D, R_SH, R_M, G_SH]))
    # silhouette with a jagged ridge
    edgeL = [0] * h
    edgeR = [0] * h
    for r in range(h):
        if r > 2:
            edgeL[r] = edgeL[r - 1] + rng.n(-1, 1)
            edgeR[r] = edgeR[r - 1] + rng.n(-1, 1)
            edgeL[r] = max(-2, min(2, edgeL[r]))
            edgeR[r] = max(-2, min(2, edgeR[r]))
    snow_h = 0 if bare else max(3, int(h * 0.30))
    ridge_x = cx + rng.n(-1, 1)
    cracks = [rng.n(-w // 3, w // 3) for _ in range(rng.n(1, 2))]
    for r in range(h):
        f = (r + 1) / h
        halfL = max(1, int(round(w / 2 * f)) + edgeL[r])
        halfR = max(1, int(round(w / 2 * f)) + edgeR[r])
        y = base_y - h + r + 1
        for x in range(ridge_x - halfL, ridge_x + halfR + 1):
            dx = x - ridge_x
            lim = min(halfL, halfR)
            if snow_h and r < snow_h:
                c = SNOW
            elif snow_h and r < snow_h + 3 and abs(dx) < lim * (0.75 - 0.25 * (r - snow_h)) + rng.n(-1, 1):
                c = SNOW
            elif dx < -2:
                c = R_L
            elif dx <= 1:
                c = R_M
            else:
                c = R_D
            if x == ridge_x - halfL or x == ridge_x + halfR:
                c = R_SH
            if r > snow_h + 1:
                for ck in cracks:
                    if x == ridge_x + int(ck * f):
                        c = R_SH
            d.point((x, y), fill=c)
        if r == h - 1:      # base rubble line
            for x in range(ridge_x - halfL - 2, ridge_x + halfR + 3):
                if rng.n(2):
                    d.point((x, y + 1), fill=rng.pick([R_D, R_SH]))

def house(d, cx, cy, w, hh, roof=ROOF, roof_d=ROOF_D):
    cx, cy = round(cx), round(cy)
    contact_shadow(d, cx + 3, cy + 1, w // 2 + 2, 2, G_SH)
    d.rectangle([cx - w // 2, cy - hh, cx - 1, cy], fill=WALL)
    d.rectangle([cx, cy - hh, cx + w // 2, cy], fill=WALL_D)
    for r in range(5):
        half = 1 + int(round(r * (w / 2) / 4))
        y = cy - hh - 5 + r
        d.line([(cx - half, y), (cx - 1, y)], fill=roof)
        d.line([(cx, y), (cx + half, y)], fill=roof_d)
    d.line([(cx - w // 2 - 1, cy - hh), (cx + w // 2 + 1, cy - hh)], fill=roof_d)
    d.rectangle([cx - 1, cy - 3, cx, cy], fill=(74, 56, 40))

def headframe(d, cx, cy, h):
    cx, cy = round(cx), round(cy)
    for k in range(h):
        y = cy - k
        off = int(round(6 * (1 - k / h))) + 1
        d.point((cx - off, y), fill=WOOD)
        d.point((cx - off + 1, y), fill=TRUNK_D)
        d.point((cx + off, y), fill=WOOD)
    d.line([(cx - 4, cy - h + 6), (cx + 4, cy - h + 6)], fill=WOOD)
    d.line([(cx - 3, cy - h), (cx + 3, cy - h)], fill=TRUNK_D)
    d.line([(cx - 2, cy - h - 1), (cx + 2, cy - h - 1)], fill=LIME)

def ore(d, cx, cy, rng):
    for dx, dy in ((-7, 2), (5, 5), (-1, 9), (8, 0)):
        x, y = round(cx + dx), round(cy + dy)
        d.rectangle([x, y, x + 1, y + 1], fill=LIME)
        d.point((x, y), fill=(226, 250, 170))

# ---------------------------------------------------------------- ground texture
def grass_texture(d, cx, ty, rng, base):
    for _ in range(rng.n(5, 8)):
        a = rng.n(360)
        rad = rng.n(4, int(R * 0.8))
        gx = cx + rad * math.cos(math.radians(a))
        gy = ty + rad * math.sin(math.radians(a)) * KY * 0.95
        if not inhex(gx - cx, gy - ty, 4):
            continue
        col = rng.pick([G_L, G_D, G_L, G_SH])
        w = rng.n(2, 5)
        d.ellipse([round(gx) - w, round(gy) - 1, round(gx) + w, round(gy) + 1], fill=col)
    for _ in range(rng.n(6, 12)):
        a = rng.n(360)
        rad = rng.n(3, int(R * 0.82))
        gx = round(cx + rad * math.cos(math.radians(a)))
        gy = round(ty + rad * math.sin(math.radians(a)) * KY * 0.95)
        if not inhex(gx - cx, gy - ty, 3):
            continue
        c = rng.pick([G_L, G_SH, G_D])
        d.point((gx, gy), fill=c)
        d.point((gx, gy - 1), fill=c)

# ---------------------------------------------------------------- tile
def tile(d, cx, cy, kind, i, j, hl=False):
    rng = Rng(i * 31 + j * 977)
    jitter = rng.pick([0, 0, 3, 5]) if kind in "GF" else 0
    elev = ELEV[kind] + jitter
    ty = cy - elev
    p = hexpts(cx, ty)
    water = kind == "W"
    if kind == "M":
        sides = ROCK_SIDE
    elif kind == "X":
        sides = SOIL_SIDE
    elif water:
        sides = [(52, 108, 124), (42, 90, 106), (34, 74, 88), (26, 58, 70)]
    else:
        sides = G_SIDE
    dep = DEPTH + elev + (6 if water else 0)
    for a, b, sh in ((1, 2, 3), (2, 3, 0), (3, 4, 1), (4, 5, 2)):
        ax, ay = p[a]; bx, by = p[b]
        d.polygon([(ax, ay), (bx, by), (bx, by + dep), (ax, ay + dep)], fill=sides[sh])
        if kind == "M":                       # cliff striations
            for t in range(1, 6):
                mx = ax + (bx - ax) * t / 6.0
                my = ay + (by - ay) * t / 6.0
                d.line([(round(mx), round(my) + 2), (round(mx), round(my) + dep - 2)],
                       fill=(60, 62, 56) if t % 2 else (92, 94, 86))

    if water:
        d.polygon(p, fill=W_SHAL, outline=W_SHAL)
        def blob(f, dy, col):
            pts = []
            for k in range(12):
                a = math.radians(k * 30 - 90)
                jf = f * (1 + (rng.n(-12, 12) / 100.0))
                pts.append((round(cx + R * jf * math.cos(a)),
                            round(ty + dy + R * jf * math.sin(a) * KY)))
            d.polygon(pts, fill=col)
        blob(0.74, 1, W_MID)
        blob(0.42, 3, W_DEEP)
        for _ in range(rng.n(4, 6)):
            dy = rng.n(-int(R * KY) + 3, int(R * KY) - 3)
            hw = half_at(dy)
            x0 = cx + rng.n(-int(hw) + 3, int(hw) - 14)
            ln = rng.n(6, 16)
            d.line([(round(x0), ty + dy), (round(min(x0 + ln, cx + hw - 3)), ty + dy)], fill=W_FOAM if rng.n(3) == 0 else W_SHAL)
        d.polygon(p, outline=(38, 84, 98))
    else:
        base = rng.pick([G_M, G_M, G_D])
        d.polygon(p, fill=base, outline=G_SH)
        grass_texture(d, cx, ty, rng, base)

    if kind == "F":
        n = rng.n(5, 7)
        spots = []
        for _ in range(n * 3):
            if len(spots) >= n:
                break
            a = rng.n(360)
            rad = rng.n(0, int(R * 0.72))
            fx = cx + rad * math.cos(math.radians(a))
            fy = ty + rad * math.sin(math.radians(a)) * KY * 0.95
            if not inhex(fx - cx, fy - ty, 7):
                continue
            if any(abs(fx - sx) < 9 and abs(fy - sy) < 5 for sx, sy in spots):
                continue
            spots.append((fx, fy))
        spots.sort(key=lambda s: s[1])
        mix = rng.n(4)
        for k, (fx, fy) in enumerate(spots):
            aut = rng.n(7) == 0
            if mix == 0 or (mix == 2 and k % 2 == 0):
                conifer(d, fx, fy, rng.n(13, 19), rng.n(9, 13), rng, autumn=aut)
            else:
                broadleaf(d, fx, fy, rng.n(4, 7), rng, autumn=aut)
    elif kind == "M":
        pts = []
        for k in range(14):
            a = math.radians(k * (360 / 14) - 90)
            rf = 0.78 + rng.n(-16, 12) / 100.0
            pts.append((round(cx + R * rf * math.cos(a)),
                        round(ty + 4 + R * rf * math.sin(a) * KY)))
        d.polygon(pts, fill=(126, 124, 108))
        for k in range(len(pts)):
            x0, y0 = pts[k]; x1, y1 = pts[(k + 1) % len(pts)]
            for t in range(0, 10):
                px_ = round(x0 + (x1 - x0) * t / 10) + rng.n(-2, 2)
                py_ = round(y0 + (y1 - y0) * t / 10) + rng.n(-1, 1)
                if inhex(px_ - cx, py_ - ty, 2):
                    d.point((px_, py_), fill=rng.pick([(148, 146, 130), G_SH, (116, 114, 102)]))
        style = rng.n(3)
        if style == 0:
            peak(d, cx + 6, ty + 10, rng.n(27, 33), rng.n(30, 38), rng)
            peak(d, cx - 15, ty + 13, rng.n(14, 19), rng.n(18, 24), rng, bare=rng.n(2) == 0)
        elif style == 1:
            peak(d, cx - 12, ty + 12, rng.n(19, 24), rng.n(22, 28), rng, bare=True)
            peak(d, cx + 10, ty + 8, rng.n(23, 29), rng.n(26, 32), rng)
            peak(d, cx + 1, ty + 15, rng.n(11, 15), rng.n(14, 19), rng, bare=True)
        else:
            peak(d, cx + 2, ty + 11, rng.n(30, 36), rng.n(34, 42), rng)
            for _ in range(3):
                bx = cx + rng.n(-22, 22); by = ty + rng.n(8, 15)
                br = rng.n(2, 4)
                d.ellipse([bx - br, by - br // 2 - 1, bx + br, by + br // 2 + 1], fill=R_M)
                d.point((bx - br, by), fill=R_SH)
        for _ in range(rng.n(1, 3)):
            conifer(d, cx + rng.n(-24, 24), ty + rng.n(10, 16), rng.n(9, 12), rng.n(7, 9), rng)
    elif kind == "X":
        for f, dy, col in ((0.76, 2, DIRT_L), (0.58, 6, DIRT), (0.38, 10, DIRT_D), (0.20, 13, (58, 42, 28))):
            d.polygon(hexpts(cx + 2, ty + dy, f), fill=col)
        for k in range(3):
            d.line([(cx - 20 + k, ty + 4), (cx - 8 + k, ty + 12)], fill=DIRT_D)
        ore(d, cx + 2, ty + 10, rng)
        headframe(d, cx - 20, ty + 2, 19)
        house(d, cx + 19, ty - 5, 13, 8)
        house(d, cx + 2, ty - 14, 10, 6, roof=ROOF_B, roof_d=ROOF_BD)
    elif kind == "G":
        v = rng.n(7)
        if v == 0:
            for _ in range(rng.n(2, 4)):
                bx = cx + rng.n(-18, 18); by = ty + rng.n(-6, 10)
                br = rng.n(2, 4)
                d.ellipse([bx - br, by - br // 2 - 1, bx + br, by + br // 2 + 1], fill=R_M)
                d.point((bx - br, by), fill=R_SH)
        elif v == 1:
            broadleaf(d, cx + rng.n(-10, 10), ty + rng.n(0, 8), rng.n(4, 6), rng)
        elif v == 2:
            for _ in range(rng.n(4, 7)):
                bx = cx + rng.n(-20, 20); by = ty + rng.n(-8, 10)
                if inhex(bx - cx, by - ty, 4):
                    d.ellipse([bx - 3, by - 1, bx + 3, by + 1], fill=G_DEEP)
                    d.point((bx - 1, by - 1), fill=G_L)
        elif v == 3:
            for k in range(rng.n(4, 7)):
                bx = cx + rng.n(-18, 18); by = ty + rng.n(-8, 8)
                if inhex(bx - cx, by - ty, 3):
                    d.point((bx, by), fill=rng.pick([(246, 232, 120), (238, 246, 236), (240, 160, 170)]))
        elif v == 4:
            fy = ty + rng.n(-2, 4)
            fw, fh = rng.n(20, 26), rng.n(7, 10)
            pts = [(cx - fw, fy), (cx - fw + 6, fy - fh), (cx + fw, fy - fh + 1),
                   (cx + fw - 6, fy + fh), (cx - fw, fy + fh - 1)]
            d.polygon([(round(a), round(b)) for a, b in pts], fill=(228, 202, 78), outline=(168, 138, 46))
            for k in range(-fh + 2, fh - 1, 3):
                y = fy + k
                d.line([(round(cx - fw + 6 + abs(k)), y), (round(cx + fw - 6 - abs(k) // 2), y)], fill=(198, 170, 50))
    if hl:
        d.polygon(p, outline=LIME)
        d.polygon(hexpts(cx, ty, 0.88), outline=LIME_D)

# ---------------------------------------------------------------- build
def build(scale=3):
    rows, cols = len(MAPS), len(MAPS[0])
    W = int(cols * STEP_X + STEP_X / 2 + 30)
    H = int((rows - 1) * STEP_Y + R * KY * 2 + DEPTH + 54)
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    ox, oy = 15 + R, 40 + R * KY
    for j in range(rows):
        for i in range(cols):
            k = MAPS[j][i]
            if k == ".":
                continue
            cx = ox + i * STEP_X + (STEP_X / 2 if j % 2 else 0)
            cy = oy + j * STEP_Y
            tile(d, cx, cy, k, i, j, hl=(j, i) in HIGHLIGHT)
    img.save(OUT + "iso_pixel2_1x.png")
    img.resize((W * scale, H * scale), Image.NEAREST).save(OUT + "iso_pixel2.png")
    print("ok", W, H, "->", W * scale, H * scale)

build()
