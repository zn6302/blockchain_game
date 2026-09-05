import math
from PIL import Image

T = 32                      # sprite is 32 wide, rows 1..30 used
PITCH_X, PITCH_Y, ROW_OFF = 32, 24, 16
OUT = "/home/claude/noxcat_tiles/"

LIME      = (163, 230, 53)
LIME_EDGE = (122, 170, 45)
WHITE     = (240, 244, 232)
GROUND    = (30, 36, 23)
GROUND_D  = (24, 29, 18)
GROUND_L  = (38, 46, 28)
BLACK     = (14, 17, 11)

def inside(x, y):
    if y < 1 or y > 30 or x < 0 or x > 31:
        return False
    if y <= 7:
        half = 2 * y
    elif y <= 23:
        half = 16
    else:
        half = 2 * (31 - y)
    return 16 - half <= x <= 15 + half

# ---------------------------------------------------------------- base
def base(px, ox, oy, seed=0, ground=GROUND):
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            if any(not inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c = LIME_EDGE
            elif (x * 5 + y * 3 + seed * 7) % 19 == 0:
                c = GROUND_L
            elif (x * 3 + y * 7 + seed * 5) % 23 == 0:
                c = GROUND_D
            else:
                c = ground
            px[ox + x, oy + y] = c + (255,)

def is_edge(x, y):
    return inside(x, y) and any(not inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))

def put(px, ox, oy, x, y, c):
    if inside(x, y) and not is_edge(x, y):
        px[ox + x, oy + y] = c + (255,)

# ---------------------------------------------------------------- mountain
ROCK_L, ROCK_D, ROCK_O = (110, 117, 101), (47, 53, 43), (18, 22, 14)
def peak(px, ox, oy, cx, base_y, w, h, cap=3):
    for r in range(h):
        half = max(1, int(round((r + 1) * w / (2.0 * h))))
        y = base_y - h + r + 1
        for x in range(cx - half, cx + half + 1):
            if r < cap or (r == cap and abs(x - cx) <= 1):
                c = WHITE
            elif x < cx:
                c = ROCK_L
            else:
                c = ROCK_D
            if x == cx - half or x == cx + half or r == h - 1:
                c = ROCK_O
            put(px, ox, oy, x, y, c)

def mountain(px, ox, oy):
    peak(px, ox, oy, 9, 25, 11, 10, cap=2)
    peak(px, ox, oy, 19, 27, 19, 17, cap=3)

# ---------------------------------------------------------------- trees
CAN_L, CAN_M, CAN_D, TRUNK = (118, 168, 60), (74, 112, 40), (44, 70, 30), (80, 62, 40)
def conifer(px, ox, oy, cx, base_y, widths, tip=False):
    for r, w in enumerate(widths):
        half = w // 2
        y = base_y - len(widths) + r
        for x in range(cx - half, cx + half + 1):
            if x < cx:
                c = CAN_L
            elif x == cx:
                c = CAN_M
            else:
                c = CAN_D
            put(px, ox, oy, x, y, c)
    put(px, ox, oy, cx, base_y, TRUNK)
    put(px, ox, oy, cx, base_y + 1, TRUNK)
    if tip:
        put(px, ox, oy, cx, base_y - len(widths), LIME)

BIG   = [1, 3, 3, 5, 5, 7, 7, 9]
SMALL = [1, 3, 3, 5, 5, 7]
TINY  = [1, 3, 3, 5]

def trees(px, ox, oy):
    conifer(px, ox, oy, 15, 26, BIG, tip=True)
    conifer(px, ox, oy, 7, 22, SMALL)
    conifer(px, ox, oy, 24, 23, SMALL)
    conifer(px, ox, oy, 11, 29, TINY)
    conifer(px, ox, oy, 21, 29, TINY)

# ---------------------------------------------------------------- mine
def mine(px, ox, oy):
    cx, cy = 16, 22
    for y in range(T):
        for x in range(T):
            d = abs(x - cx) + abs(y - cy) * 1.7
            if d < 5:
                put(px, ox, oy, x, y, (10, 13, 8))
            elif d < 8:
                put(px, ox, oy, x, y, (20, 25, 15))
            elif d < 10:
                put(px, ox, oy, x, y, (42, 50, 31))
    for bx, by in ((12, 22), (18, 21), (15, 25)):        # ore crystals 2x2
        for dx in range(2):
            for dy in range(2):
                put(px, ox, oy, bx + dx, by + dy, LIME)
        put(px, ox, oy, bx, by, WHITE)
    # head frame / hut
    for y in range(11, 18):
        for x in range(10, 19):
            put(px, ox, oy, x, y, (118, 126, 98) if x < 14 else (86, 94, 70))
    for x in range(9, 20):
        put(px, ox, oy, x, 10, (18, 22, 14))
    for x in range(9, 20):
        put(px, ox, oy, x, 9, WHITE)
    for x in range(11, 18):
        put(px, ox, oy, x, 8, WHITE)
    for y in range(14, 18):          # door
        for x in (14, 15):
            put(px, ox, oy, x, y, (14, 17, 11))
    for wx in (11, 12):
        put(px, ox, oy, wx, 12, LIME)   # window
    put(px, ox, oy, 17, 12, LIME)
    for y, x in ((18, 12), (19, 12), (18, 18), (19, 18)):   # beams to pit
        put(px, ox, oy, x, y, (58, 46, 30))

# ---------------------------------------------------------------- river
W_DEEP, W_MID, W_LIGHT, W_FOAM = (16, 46, 45), (35, 88, 82), (72, 150, 133), (226, 244, 236)
BANK = (46, 54, 32)
def river(px, ox, oy):
    for x in range(T):
        c = 17 + int(round(2.2 * math.sin(x / 5.0)))
        half = 3 if x % 5 else 4
        for y in range(c - half - 1, c + half + 2):
            if not inside(x, y):
                continue
            d = abs(y - c)
            if d > half:
                col = BANK
            elif d == half:
                col = W_DEEP
            elif d == half - 1:
                col = W_MID
            else:
                col = W_LIGHT if (x * 2 + y) % 11 == 0 else W_MID
            if (x * 7 + y * 5) % 37 == 0 and d < half - 1:
                col = W_FOAM
            px[ox + x, oy + y] = col + (255,)

BUILDERS = {
    "plain": lambda px, ox, oy: None,
    "mountain": mountain,
    "tree": trees,
    "mine": mine,
    "river": river,
}

def make_tile(kind, seed=0):
    img = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    px = img.load()
    base(px, 0, 0, seed=seed)
    BUILDERS[kind](px, 0, 0)
    return img

if __name__ == "__main__":
    S = 8
    for k in BUILDERS:
        im = make_tile(k)
        im.resize((T * S, T * S), Image.NEAREST).save(f"{OUT}hex_{k}.png")
        im.save(f"{OUT}hex_{k}_32px.png")
    print("tiles ok")
