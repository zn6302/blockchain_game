import math, os

OUT = "/home/claude/noxcat_tiles/"

# ---------------------------------------------------------------- palette
BG          = "#0B0B0B"
LIME        = "#A3E635"
LIME_D      = "#6E9E22"
CREAM       = "#EDF0E4"
CREAM_D     = "#BCC2AE"

G_TOP       = "#33553F"
G_TOP_ALT   = "#2E4C39"
G_SIDE      = ["#22382A", "#1B2E23", "#16261C", "#111E17"]

W_TOP       = "#2E9296"
W_STRIPE    = "#4DBDB6"
W_SIDE      = ["#1D6165", "#175055", "#134247", "#0F3439"]

ROCK_L      = "#C7CFBB"
ROCK_M      = "#8A9382"
ROCK_D      = "#4E564A"

TREE_L      = LIME
TREE_M      = "#7FBB2A"
TREE_D      = "#4A7318"
TRUNK       = "#2A2117"

WALL        = "#E9E3CC"
WALL_D      = "#A9A48D"
WOOD        = "#5A4630"
SHADOW      = "#000000"

# ---------------------------------------------------------------- geometry
R      = 74.0          # hex circumradius (world)
KY     = 0.56          # isometric squash
DEPTH  = 46.0          # tile slab thickness
STEP_X = math.sqrt(3) * R
STEP_Y = 1.5 * R * KY

MAPS = [
    "...GGFF...",
    "..GGFFMM..",
    ".GGWWGFMM.",
    ".GXWWGGGM.",
    "GGGWWGGFG.",
    ".GGGWWGXG.",
    "..GFFWWGG.",
    "...GGGWG..",
]
ELEV = {"G": 0, "F": 0, "M": 16, "X": 0, "W": -12}
HIGHLIGHT = {(4, 6), (6, 7)}      # (row, col) tiles shown as placement slots

def hex_pts(cx, cy, f=1.0):
    pts = []
    for i in range(6):
        a = math.radians(i * 60 - 90)
        pts.append((cx + R * f * math.cos(a), cy + R * f * math.sin(a) * KY))
    return pts        # 0 top, 1 upper-right, 2 lower-right, 3 bottom, 4 lower-left, 5 upper-left

def poly(pts, fill, extra=""):
    d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return f'<polygon points="{d}" fill="{fill}" {extra}/>'

def rnd(i, j, n):
    return (i * 7919 + j * 104729) % n

# ---------------------------------------------------------------- props
def shadow(cx, cy, rx, ry=None, op=0.30):
    ry = ry or rx * 0.5
    return f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{SHADOW}" opacity="{op}"/>'

def tree(cx, cy, s=1.0):
    h = 40 * s
    w = 15 * s
    o = shadow(cx + 5 * s, cy + 3 * s, w * 1.15, w * 0.5)
    o += f'<rect x="{cx-2.2*s:.1f}" y="{cy-6*s:.1f}" width="{4.4*s:.1f}" height="{9*s:.1f}" fill="{TRUNK}"/>'
    for lvl, (dy, ww) in enumerate(((0, w), (-h * 0.32, w * 0.78), (-h * 0.60, w * 0.52))):
        base = cy - 4 * s + dy
        apex = base - h * 0.46
        o += poly([(cx, apex), (cx - ww, base), (cx, base + ww * 0.36 * KY * 2)], TREE_L)
        o += poly([(cx, apex), (cx + ww, base), (cx, base + ww * 0.36 * KY * 2)], TREE_D)
    o += poly([(cx, cy - 4 * s - h * 0.60 - h * 0.46), (cx - 3 * s, cy - 4 * s - h * 0.60 - h * 0.30),
               (cx + 3 * s, cy - 4 * s - h * 0.60 - h * 0.30)], TREE_M)
    return o

def rock(cx, cy, s=1.0, snow=True):
    H = 62 * s
    w = 30 * s
    o = shadow(cx + 8 * s, cy + 4 * s, w * 1.1, w * 0.48)
    apex = (cx + 2 * s, cy - H)
    o += poly([apex, (cx - w, cy), (cx - w * 0.15, cy + 9 * s * KY * 2)], ROCK_L)
    o += poly([apex, (cx + w, cy - 4 * s), (cx - w * 0.15, cy + 9 * s * KY * 2)], ROCK_M)
    o += poly([apex, (cx + w, cy - 4 * s), (cx + w * 0.55, cy - H * 0.42)], ROCK_D)
    if snow:
        o += poly([apex, (cx - w * 0.30, cy - H * 0.55), (cx + 2 * s, cy - H * 0.45),
                   (cx + w * 0.26, cy - H * 0.60)], CREAM)
    o += poly([(cx - w * 0.78, cy - 2 * s), (cx - w * 0.30, cy - H * 0.30),
               (cx - w * 0.05, cy + 6 * s), (cx - w * 0.85, cy + 5 * s)], ROCK_D)
    return o

def house(cx, cy, s=1.0, roof=LIME, roof_d=LIME_D):
    w, h, d = 24 * s, 20 * s, 13 * s
    o = shadow(cx + 7 * s, cy + 3 * s, w * 1.05, w * 0.46)
    o += poly([(cx - w, cy), (cx, cy + d * KY * 1.6), (cx, cy - h + d * KY * 1.6), (cx - w, cy - h)], WALL)
    o += poly([(cx + w, cy), (cx, cy + d * KY * 1.6), (cx, cy - h + d * KY * 1.6), (cx + w, cy - h)], WALL_D)
    o += poly([(cx - w, cy - h), (cx, cy - h + d * KY * 1.6), (cx, cy - h - 15 * s)], roof)
    o += poly([(cx + w, cy - h), (cx, cy - h + d * KY * 1.6), (cx, cy - h - 15 * s)], roof_d)
    o += poly([(cx - w, cy - h), (cx, cy - h - 15 * s), (cx + w, cy - h)], roof)
    return o

def headframe(cx, cy, s=1.0):
    o = shadow(cx + 6 * s, cy + 2 * s, 20 * s, 9 * s)
    o += poly([(cx - 14 * s, cy), (cx - 8 * s, cy - 44 * s), (cx - 4 * s, cy - 44 * s), (cx - 9 * s, cy)], WOOD)
    o += poly([(cx + 14 * s, cy), (cx + 8 * s, cy - 44 * s), (cx + 4 * s, cy - 44 * s), (cx + 9 * s, cy)], WOOD)
    o += f'<rect x="{cx-10*s:.1f}" y="{cy-26*s:.1f}" width="{20*s:.1f}" height="{4*s:.1f}" fill="{WOOD}"/>'
    o += poly([(cx - 9 * s, cy - 44 * s), (cx + 9 * s, cy - 44 * s), (cx, cy - 54 * s)], LIME)
    return o

def ore(cx, cy, s=1.0):
    o = ""
    for dx, dy, r in ((-10, 4, 6), (8, 8, 5), (0, 14, 4.5)):
        x, y = cx + dx * s, cy + dy * s * KY * 1.6
        o += poly([(x, y - r * s), (x + r * 0.8 * s, y), (x, y + r * s * 0.9), (x - r * 0.8 * s, y)], LIME)
    return o

# ---------------------------------------------------------------- tiles
def tile(cx, cy, kind, i, j, hl=False):
    elev = ELEV[kind] + (7 if (kind in "GF" and rnd(i, j, 4) == 0) else 0)
    top_y = cy - elev
    p = hex_pts(cx, top_y)
    water = kind == "W"
    sides = W_SIDE if water else G_SIDE
    d = DEPTH + elev + (10 if water else 0)
    o = ""
    # skirt faces: edges 1-2, 2-3, 3-4, 4-5
    order = [(1, 2, 3), (2, 3, 0), (3, 4, 1), (4, 5, 2)]
    for a, b, shade in order:
        ax, ay = p[a]; bx, by = p[b]
        o += poly([(ax, ay), (bx, by), (bx, by + d), (ax, ay + d)], sides[shade])
    # top face
    if water:
        base = W_TOP
    else:
        base = G_TOP if rnd(i, j, 3) else G_TOP_ALT
    o += poly(p, base, f'stroke="#0E1A13" stroke-width="1.6" stroke-linejoin="round" stroke-opacity="0.55"')
    if water:
        cid = f"w{i}_{j}"
        dpts = " ".join(f"{x:.1f},{y:.1f}" for x, y in p)
        o += f'<clipPath id="{cid}"><polygon points="{dpts}"/></clipPath><g clip-path="url(#{cid})">'
        for yy, ww, xoff in ((-0.34, 0.50, -10), (-0.05, 0.72, 18), (0.26, 0.58, -22), (0.52, 0.34, 10)):
            y = top_y + R * KY * yy
            o += f'<rect x="{cx + xoff - R*ww*0.9:.1f}" y="{y:.1f}" width="{R*ww*1.8:.1f}" height="4.6" rx="2.3" fill="{W_STRIPE}" opacity="0.85"/>'
        o += f'<circle cx="{cx-24:.1f}" cy="{top_y+10:.1f}" r="2.8" fill="{CREAM}" opacity="0.85"/>'
        o += f'<circle cx="{cx+26:.1f}" cy="{top_y-14:.1f}" r="2.2" fill="{CREAM}" opacity="0.75"/>'
        o += '</g>'
    if kind == "F":
        for dx, dy, s in ((-30, 8, 1.05), (6, -10, 1.25), (30, 16, 0.95), (-8, 26, 0.85), (-40, -8, 0.8)):
            o += tree(cx + dx, top_y + dy * KY * 1.6, s)
    elif kind == "M":
        o += rock(cx - 26, top_y + 18 * KY * 1.6, 0.85)
        o += rock(cx + 20, top_y + 4 * KY * 1.6, 1.35)
    elif kind == "X":
        for f, dy, col in ((0.70, 5, "#2B4334"), (0.50, 13, "#1A2C21"), (0.30, 21, "#0C140E")):
            o += poly(hex_pts(cx + 4, top_y + dy, f), col)
        o += ore(cx + 2, top_y + 22, 1.4)
        o += headframe(cx - 42, top_y - 2, 1.15)
        o += house(cx + 38, top_y - 16, 0.8)
        o += house(cx + 4, top_y - 30, 0.55)
    if kind == "G":
        v = rnd(i, j, 6)
        if v == 0:
            for dx, dy, r in ((-24, 14, 7), (-10, 20, 4.5)):
                o += shadow(cx + dx + 4, top_y + dy + 3, r * 1.1, r * 0.5, 0.25)
                o += poly([(cx + dx, top_y + dy - r), (cx + dx + r, top_y + dy), (cx + dx, top_y + dy + r * 0.6), (cx + dx - r, top_y + dy)], ROCK_M)
        elif v == 1:
            o += tree(cx + 18, top_y + 12, 0.62)
        elif v == 2:
            for dx, dy in ((-16, 6), (2, 16), (16, 2)):
                o += f'<ellipse cx="{cx+dx:.1f}" cy="{top_y+dy:.1f}" rx="7" ry="3.4" fill="{TREE_D}" opacity="0.85"/>'
    if hl:
        dpts = " ".join(f"{x:.1f},{y:.1f}" for x, y in p)
        o += f'<polygon points="{dpts}" fill="{LIME}" opacity="0.10"/>'
        o += f'<polygon points="{dpts}" fill="none" stroke="{LIME}" stroke-width="3" stroke-linejoin="round"/>'
    return o

# ---------------------------------------------------------------- build
def build():
    rows, cols = len(MAPS), len(MAPS[0])
    W, H = 1520, 860
    ox, oy = 110, 190
    body = [f'<rect width="{W}" height="{H}" fill="{BG}"/>']
    for j in range(rows):
        for i in range(cols):
            k = MAPS[j][i]
            if k == ".":
                continue
            cx = ox + i * STEP_X + (STEP_X / 2 if j % 2 else 0)
            cy = oy + j * STEP_Y
            body.append(tile(cx, cy, k, i, j, hl=(j, i) in HIGHLIGHT))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">' + "".join(body) + "</svg>"
    open(OUT + "iso_hex_map.svg", "w").write(svg)
    print("ok")

build()
