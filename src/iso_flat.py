import math

OUT = "/home/claude/noxcat_tiles/"

# ---------------------------------------------------------------- palette (flat, Thronefall-ish)
BG        = "#0F1A18"
G_TOP     = "#356E5D"
G_TOP_2   = "#316857"
G_SEAM    = "#2A5B4C"
G_SIDE    = ["#2A5A4B", "#245046", "#1D423A", "#17352F"]
SHADOW    = "#1E4A40"          # cast shadow on grass
SHADOW_D  = "#173C35"

CLIFF     = ["#8A9793", "#74817E", "#5E6A68", "#4B5654"]
ROCK_L    = "#F2F0E2"
ROCK_M    = "#C6CDC4"
ROCK_D    = "#93A2A4"
ROCK_S    = "#5E7076"

TREE_L    = "#9AD489"
TREE_M    = "#6FB477"
TREE_D    = "#3F8461"
TREE_S    = "#2A6353"

W_TOP     = "#49A6E4"
W_LIGHT   = "#7CC6F1"
W_DARK    = "#2F79B8"
W_FOAM    = "#EAF6FF"

WOOD_L    = "#E9BE83"
WOOD_M    = "#C68F52"
WOOD_D    = "#8C5F35"
WALL      = "#F2EFE0"
WALL_D    = "#C9C4AF"
ROOF      = "#D98457"
ROOF_D    = "#A75C3A"
SOIL      = ["#9A7448", "#7E5C38", "#63472B", "#4A341F"]

LIME      = "#A3E635"
LIME_D    = "#6E9E22"

# ---------------------------------------------------------------- geometry
R      = 78.0
KY     = 0.56
DEPTH  = 42.0
STEP_X = math.sqrt(3) * R
STEP_Y = 1.5 * R * KY
SH_DX, SH_DY = 0.85, 0.34      # cast-shadow direction (light from upper-left)

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
ELEV = {"G": 0, "F": 0, "M": 20, "X": 0, "W": -13}
HIGHLIGHT = {(4, 6), (6, 7)}

class Rng:
    def __init__(self, seed):
        self.s = (seed * 2654435761) % 4294967291 + 7
    def n(self, a, b=None):
        self.s = (self.s * 1103515245 + 12345) % 2147483648
        return self.s % a if b is None else a + self.s % (b - a + 1)
    def f(self, a, b):
        return a + (b - a) * (self.n(1000) / 1000.0)
    def pick(self, seq):
        return seq[self.n(len(seq))]

def hexpts(cx, cy, f=1.0):
    return [(cx + R * f * math.cos(math.radians(k * 60 - 90)),
             cy + R * f * math.sin(math.radians(k * 60 - 90)) * KY) for k in range(6)]

def half_at(dy):
    hy = R * KY
    if abs(dy) <= hy / 2:
        return math.sqrt(3) / 2 * R
    t = (abs(dy) - hy / 2) / (hy / 2)
    return max(0.0, math.sqrt(3) / 2 * R * (1 - t))

def inhex(dx, dy, pad=0):
    return abs(dx) <= half_at(dy) - pad and abs(dy) <= R * KY - pad * KY

def poly(pts, fill, extra=""):
    d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return f'<polygon points="{d}" fill="{fill}" {extra}/>'

def ell(cx, cy, rx, ry, fill, op=1.0):
    return f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}" opacity="{op}"/>'

# ---------------------------------------------------------------- props (returns (shadow, body))
def tree(cx, cy, h, w, pale=False):
    L = "#B6E29B" if pale else TREE_L
    M = "#84C486" if pale else TREE_M
    D = "#4E9468" if pale else TREE_D
    apex = (cx, cy - h)
    bl, br = (cx - w / 2, cy), (cx + w / 2, cy)
    sh = poly([bl, br, (cx + h * SH_DX + w * 0.15, cy + h * SH_DY)], SHADOW)
    sh += ell(cx, cy, w * 0.48, w * 0.2, SHADOW)
    b = poly([apex, bl, (cx, cy + w * 0.16)], L)
    b += poly([apex, br, (cx, cy + w * 0.16)], D)
    b += poly([apex, (cx - w * 0.16, cy - h * 0.42), (cx + w * 0.10, cy - h * 0.40)], M)
    return sh, b

def bush(cx, cy, r):
    sh = ell(cx + r * 0.5, cy + r * 0.18, r * 1.05, r * 0.42, SHADOW)
    b = ell(cx, cy - r * 0.30, r, r * 0.62, TREE_D)
    b += ell(cx - r * 0.25, cy - r * 0.48, r * 0.62, r * 0.40, TREE_M)
    return sh, b

def rockmass(cx, cy, h, w, rng, snow=True):
    """faceted cream cliff chunk"""
    top = (cx + rng.f(-w * 0.10, w * 0.12), cy - h)
    ridgeL = (cx - w * 0.52, cy - h * rng.f(0.18, 0.34))
    ridgeR = (cx + w * 0.55, cy - h * rng.f(0.16, 0.32))
    bl = (cx - w * 0.60, cy + h * 0.02)
    br = (cx + w * 0.62, cy + h * 0.02)
    mid = (cx + w * 0.04, cy + h * 0.07)
    sh = poly([bl, br, (br[0] + h * SH_DX * 0.9, br[1] + h * SH_DY * 0.9),
               (top[0] + h * SH_DX, top[1] + h * SH_DY + h)], SHADOW)
    sh += ell(cx + w * 0.1, cy + h * 0.03, w * 0.62, w * 0.22, SHADOW)
    b = poly([top, ridgeL, bl, mid], ROCK_L)
    b += poly([top, mid, br, ridgeR], ROCK_D)
    b += poly([top, mid, ridgeL], ROCK_M) if rng.n(2) else poly([top, mid, ridgeR], ROCK_M)
    b += poly([bl, mid, (mid[0], mid[1] + h * 0.06), (bl[0] + w * 0.1, bl[1] + h * 0.05)], ROCK_S)
    if snow:
        b += poly([top, (top[0] - w * 0.20, cy - h * 0.62), (top[0] + w * 0.05, cy - h * 0.56),
                   (top[0] + w * 0.22, cy - h * 0.70)], "#FFFFFF")
    return sh, b

def boulder(cx, cy, r):
    sh = ell(cx + r * 0.55, cy + r * 0.2, r * 1.0, r * 0.4, SHADOW)
    b = poly([(cx - r, cy), (cx - r * 0.4, cy - r * 0.9), (cx + r * 0.5, cy - r * 0.8),
              (cx + r, cy + r * 0.1), (cx, cy + r * 0.35)], ROCK_M)
    b += poly([(cx - r * 0.4, cy - r * 0.9), (cx + r * 0.5, cy - r * 0.8), (cx + r * 0.1, cy - r * 0.35)], ROCK_L)
    b += poly([(cx + r * 0.5, cy - r * 0.8), (cx + r, cy + r * 0.1), (cx + r * 0.1, cy - r * 0.35)], ROCK_D)
    return sh, b

def hut(cx, cy, w, h, roof=ROOF, roof_d=ROOF_D):
    d = w * 0.55
    sh = poly([(cx - w, cy), (cx + w, cy),
               (cx + w + (h + d) * SH_DX, cy + (h + d) * SH_DY),
               (cx - w + (h + d) * SH_DX * 0.6, cy + (h + d) * SH_DY)], SHADOW)
    b = poly([(cx - w, cy), (cx, cy + d * KY), (cx, cy + d * KY - h), (cx - w, cy - h)], WALL)
    b += poly([(cx + w, cy), (cx, cy + d * KY), (cx, cy + d * KY - h), (cx + w, cy - h)], WALL_D)
    b += poly([(cx - w * 1.1, cy - h), (cx, cy + d * KY - h), (cx, cy - h - w * 0.75)], roof)
    b += poly([(cx + w * 1.1, cy - h), (cx, cy + d * KY - h), (cx, cy - h - w * 0.75)], roof_d)
    b += poly([(cx - w * 1.1, cy - h), (cx, cy - h - w * 0.75), (cx + w * 1.1, cy - h)], roof)
    return sh, b

def headframe(cx, cy, h):
    sh = poly([(cx - h * 0.24, cy), (cx + h * 0.24, cy),
               (cx + h * SH_DX + h * 0.2, cy + h * SH_DY), (cx + h * SH_DX - h * 0.1, cy + h * SH_DY)], SHADOW)
    b = poly([(cx - h * 0.30, cy), (cx - h * 0.20, cy), (cx - h * 0.05, cy - h), (cx - h * 0.12, cy - h)], WOOD_M)
    b += poly([(cx + h * 0.30, cy), (cx + h * 0.20, cy), (cx + h * 0.05, cy - h), (cx + h * 0.12, cy - h)], WOOD_D)
    b += f'<rect x="{cx - h*0.20:.1f}" y="{cy - h*0.55:.1f}" width="{h*0.40:.1f}" height="{h*0.06:.1f}" fill="{WOOD_L}"/>'
    b += poly([(cx - h * 0.16, cy - h), (cx + h * 0.16, cy - h), (cx, cy - h * 1.16)], LIME)
    return sh, b

# ---------------------------------------------------------------- tile
def tile(cx, cy, kind, i, j, hl=False):
    rng = Rng(i * 131 + j * 977)
    elev = ELEV[kind] + (rng.pick([0, 0, 5, 9]) if kind in "GF" else 0)
    ty = cy - elev
    p = hexpts(cx, ty)
    water = kind == "W"
    sides = CLIFF if kind == "M" else (SOIL if kind == "X" else
            (["#2F6E8E", "#28607E", "#20506A", "#1A4157"] if water else G_SIDE))
    dep = DEPTH + elev + (10 if water else 0)
    o = ""
    for a, b, sh in ((1, 2, 3), (2, 3, 0), (3, 4, 1), (4, 5, 2)):
        ax, ay = p[a]; bx, by = p[b]
        o += poly([(ax, ay), (bx, by), (bx, by + dep), (ax, ay + dep)], sides[sh])

    # ---- top face
    if water:
        o += poly(p, "#6FBDEE", f'stroke="{W_DARK}" stroke-width="2" stroke-linejoin="round"')
        o += poly(hexpts(cx, ty + 2, 0.80), W_TOP)
        cid = f"c{i}_{j}"
        dpts = " ".join(f"{x:.1f},{y:.1f}" for x, y in p)
        o += f'<clipPath id="{cid}"><polygon points="{dpts}"/></clipPath><g clip-path="url(#{cid})">'
        for k in range(rng.n(3, 5)):
            yy = ty + rng.f(-R * KY * 0.75, R * KY * 0.75)
            xx = cx + rng.f(-40, 20)
            ln = rng.f(26, 62)
            o += f'<rect x="{xx:.1f}" y="{yy:.1f}" width="{ln:.1f}" height="4.5" rx="2.2" fill="{W_LIGHT}"/>'
        for k in range(rng.n(2, 4)):
            o += ell(cx + rng.f(-46, 46), ty + rng.f(-24, 24), 3.2, 2.0, W_FOAM)
        o += '</g>'
    else:
        base = G_TOP if rng.n(4) else G_TOP_2
        o += poly(p, base, f'stroke="{G_SEAM}" stroke-width="1.6" stroke-linejoin="round"')

    shadows, bodies = "", ""

    if kind == "F":
        pts = []
        for _ in range(26):
            if len(pts) >= rng.n(5, 7):
                break
            a = rng.f(0, 360); rad = rng.f(0, R * 0.66)
            fx = cx + rad * math.cos(math.radians(a))
            fy = ty + rad * math.sin(math.radians(a)) * KY * 0.95
            if not inhex(fx - cx, fy - ty, 16):
                continue
            if any(abs(fx - qx) < 20 and abs(fy - qy) < 10 for qx, qy in pts):
                continue
            pts.append((fx, fy))
        pts.sort(key=lambda q: q[1])
        for k, (fx, fy) in enumerate(pts):
            if rng.n(5) == 0:
                s, b = bush(fx, fy, rng.f(9, 13))
            else:
                h = rng.f(34, 54); w = h * rng.f(0.48, 0.60)
                s, b = tree(fx, fy, h, w, pale=rng.n(6) == 0)
            shadows += s; bodies += b
    elif kind == "M":
        style = rng.n(3)
        groups = ([(6, 12, 1.0), (-30, 16, 0.55)] if style == 0 else
                  [(-26, 16, 0.68), (16, 10, 0.92), (0, 22, 0.42)] if style == 1 else
                  [(2, 14, 1.15)])
        for dx, dy, sc in groups:
            h = rng.f(60, 78) * sc
            w = rng.f(58, 76) * sc
            s, b = rockmass(cx + dx, ty + dy, h, w, rng, snow=(sc > 0.6 and rng.n(4)))
            shadows += s; bodies += b
        for _ in range(rng.n(1, 3)):
            s, b = boulder(cx + rng.f(-48, 48), ty + rng.f(6, 24), rng.f(6, 11))
            shadows += s; bodies += b
        for _ in range(rng.n(1, 2)):
            h = rng.f(26, 36)
            s, b = tree(cx + rng.f(-46, 46), ty + rng.f(12, 26), h, h * 0.52)
            shadows += s; bodies += b
    elif kind == "X":
        for f, dy, col in ((0.78, 4, SOIL[0]), (0.58, 12, SOIL[1]), (0.38, 19, SOIL[2]), (0.20, 25, SOIL[3])):
            o += poly(hexpts(cx + 4, ty + dy, f), col)
        for dx, dy, r in ((-14, 22, 7), (12, 16, 6), (2, 32, 5)):
            bodies += poly([(cx + dx, ty + dy - r), (cx + dx + r * 0.8, ty + dy),
                            (cx + dx, ty + dy + r * 0.85), (cx + dx - r * 0.8, ty + dy)], LIME)
        s, b = headframe(cx - 40, ty + 2, 46); shadows += s; bodies += b
        s, b = hut(cx + 34, ty - 10, 17, 15); shadows += s; bodies += b
        s, b = hut(cx + 4, ty - 26, 12, 11, roof="#7FB4D8", roof_d="#5286AC"); shadows += s; bodies += b
    elif kind == "G":
        v = rng.n(8)
        if v == 0:
            for _ in range(rng.n(2, 3)):
                s, b = boulder(cx + rng.f(-38, 38), ty + rng.f(-10, 18), rng.f(6, 10))
                shadows += s; bodies += b
        elif v == 1:
            s, b = tree(cx + rng.f(-16, 16), ty + rng.f(0, 14), rng.f(32, 44), 20)
            shadows += s; bodies += b
        elif v in (2, 3):
            for _ in range(rng.n(2, 4)):
                bx, by = cx + rng.f(-38, 38), ty + rng.f(-16, 18)
                if inhex(bx - cx, by - ty, 14):
                    s, b = bush(bx, by, rng.f(7, 11))
                    shadows += s; bodies += b
        elif v == 4:
            for _ in range(rng.n(3, 5)):
                bx, by = cx + rng.f(-40, 40), ty + rng.f(-18, 20)
                if inhex(bx - cx, by - ty, 10):
                    o += ell(bx, by, rng.f(9, 14), rng.f(3.5, 5.5), G_TOP_2)
        elif v == 5:
            o += ell(cx + rng.f(-20, 20), ty + rng.f(-8, 10), rng.f(20, 30), rng.f(8, 12), G_TOP_2)
    o += shadows + bodies
    if hl:
        dpts = " ".join(f"{x:.1f},{y:.1f}" for x, y in p)
        o += f'<polygon points="{dpts}" fill="{LIME}" opacity="0.10"/>'
        o += f'<polygon points="{dpts}" fill="none" stroke="{LIME}" stroke-width="3.4" stroke-linejoin="round"/>'
    return o

# ---------------------------------------------------------------- build
def build():
    rows, cols = len(MAPS), len(MAPS[0])
    W = int(cols * STEP_X + STEP_X / 2 + 60)
    H = int((rows - 1) * STEP_Y + R * KY * 2 + DEPTH + 130)
    body = [f'<rect width="{W}" height="{H}" fill="{BG}"/>']
    ox, oy = 30 + R, 100
    for j in range(rows):
        for i in range(cols):
            k = MAPS[j][i]
            if k == ".":
                continue
            cx = ox + i * STEP_X + (STEP_X / 2 if j % 2 else 0)
            cy = oy + j * STEP_Y
            body.append(tile(cx, cy, k, i, j, hl=(j, i) in HIGHLIGHT))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">' + "".join(body) + "</svg>"
    open(OUT + "iso_flat_map.svg", "w").write(svg)
    print("ok", W, H)

build()
