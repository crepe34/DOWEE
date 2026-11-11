"""Low-poly header trees. Six canopies are triangle mosaics in which the letters C R E F L O
emerge from the colours of the facets (no drawn type).
Run: python3 tools/header-trees.py, then npm run build."""
import math, os, random, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(11)
FONT = {
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
}
def shade(hexc, k):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    f = lambda v: max(0, min(255, round(v * k if k < 1 else v + (255 - v) * (k - 1))))
    return '#%02x%02x%02x' % (f(r), f(g), f(b))
# (letter, outline shape, letter colour, two background colours)
LETTER_TREES = [
    ('C', 'octagon', '#8c5bc4', ('#f8cf3f', '#f6e27a')),
    ('R', 'pointed', '#e9467e', ('#86bf4f', '#b7dc7a')),
    ('E', 'hexagon', '#3f74c9', ('#f39a3b', '#f8cf3f')),
    ('F', 'cone', '#c64f9a', ('#a3dcea', '#6fa0e0')),
    ('L', 'pointed', '#2e7d5b', ('#f6e27a', '#f8cf3f')),
    ('O', 'octagon', '#e9467e', ('#8c5bc4', '#b18be0')),
]
CELL, COLS, ROWS = 2.6, 7, 9  # 5x7 letter with a one-cell border of background facets
uid = [0]
def mosaic_tree(cx, base, letter, shape, lc, bgs):
    w, h = CELL * COLS, CELL * ROWS
    trunk = 7
    x0, y0 = cx - w / 2, base - trunk - h
    # jittered grid points shared by neighbouring triangles: a true low-poly mesh
    pts = [[(x0 + i * CELL + (random.uniform(-.55, .55) if 0 < i < COLS else 0), y0 + j * CELL + (random.uniform(-.55, .55) if 0 < j < ROWS else 0)) for i in range(COLS + 1)] for j in range(ROWS + 1)]
    bm = FONT[letter]
    on = lambda i, j: 1 <= i <= 5 and 1 <= j <= 7 and bm[j - 1][i - 1] == '#'
    tris = []
    for j in range(ROWS):
        for i in range(COLS):
            a, b, c, d = pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]
            pair = [(a, b, c), (a, c, d)] if (i + j) % 2 else [(a, b, d), (b, c, d)]
            if on(i, j): cols = [shade(lc, 1.0 + random.uniform(-.06, .1)), shade(lc, 0.82 + random.uniform(-.05, .05))]
            else: base_c = random.choice(bgs); cols = [shade(base_c, 1.0 + random.uniform(-.04, .08)), shade(base_c, 0.9 + random.uniform(-.04, .04))]
            for t, col in zip(pair, cols): tris.append((t, col))
    # canopy outline
    L, R, T, B, mx = x0 - 1, x0 + w + 1, y0 - 1, y0 + h + 1, cx
    shapes = {
        'octagon': [(L + 3.5, T), (R - 3.5, T), (R, T + 3.5), (R, B - 3.5), (R - 3.5, B), (L + 3.5, B), (L, B - 3.5), (L, T + 3.5)],
        'pointed': [(mx, T - 7), (R, T + 3), (R, B - 2), (mx + 4, B), (mx - 4, B), (L, B - 2), (L, T + 3)],
        'hexagon': [(mx, T - 5), (R, T + 2), (R, B - 2), (mx, B + 4), (L, B - 2), (L, T + 2)],
        'cone': [(mx - 2, T - 5), (mx + 2, T - 5), (R, T + 5), (R + 1, B - 1), (L - 1, B - 1), (L, T + 5)],
    }
    outline = shapes[shape]
    uid[0] += 1; cid = f'cfo{uid[0]}'
    pts_s = ' '.join(f'{x:.1f},{y:.1f}' for x, y in outline)
    # background facets also fill the shape's extra tips (above/below the grid)
    tipc = shade(bgs[0], 0.95)
    out = [f'<rect x="{cx - 2.2:.1f}" y="{base - trunk - .5:.1f}" width="4.4" height="{trunk + 1.5:.1f}" fill="#2e2a4f"/>',
           f'<clipPath id="{cid}"><polygon points="{pts_s}"/></clipPath>',
           f'<g clip-path="url(#{cid})"><polygon points="{pts_s}" fill="{tipc}"/>']
    out += [f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in t)}" fill="{c}" stroke="{c}" stroke-width=".25"/>' for t, c in tris]
    out.append('</g>')
    return ''.join(out), w
def plain_tree(cx, base, r, kind):
    PAL = ['#f8cf3f', '#f39a3b', '#e9467e', '#8c5bc4', '#3f74c9', '#86bf4f', '#f6e27a', '#c64f9a', '#6fa0e0']
    out = [f'<rect x="{cx - 2.2:.1f}" y="{base - r * 0.6:.1f}" width="4.4" height="{r * 0.6 + 1:.1f}" fill="#2e2a4f"/>']
    cy = base - r * 0.6 - r * 0.85
    n = 6 if kind == 'round' else 4
    pts = []
    for i in range(n):
        a = -math.pi / 2 + i * 2 * math.pi / n
        rr = r * (1.25 if (kind != 'round' and i == 0) else 1)
        pts.append((cx + rr * math.cos(a) * (0.85 if kind != 'round' else 1), cy + rr * math.sin(a) * (1.3 if kind != 'round' else 1)))
    cols = random.sample(PAL, 3)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        out.append(f'<polygon points="{cx:.1f},{cy:.1f} {a[0]:.1f},{a[1]:.1f} {b[0]:.1f},{b[1]:.1f}" fill="{cols[i % 3]}"/>')
    return ''.join(out)

BASE = 58
parts = ['<g fill="#fffaf1" opacity=".95"><polygon points="62,8 74,2 88,6 82,13 66,13"/><polygon points="226,10 240,3 258,8 250,15 232,15"/></g>']
x = 12
parts.append(plain_tree(x, BASE, 10, 'tall')); x += 10 + 6
for k, (letter, shape, lc, bgs) in enumerate(LETTER_TREES):
    w = CELL * COLS
    cx = x + w / 2 + 1
    svgp, _ = mosaic_tree(cx, BASE, letter, shape, lc, bgs)
    parts.append(svgp); x += w + 5.5
x += 3
parts.append(plain_tree(x, BASE, 9, 'round')); x += 9 * 2 + 4
parts.append(plain_tree(x, BASE, 11, 'tall')); x += 14
svg = f'<svg viewBox="0 0 {x:.0f} 60" aria-hidden="true">{"".join(parts)}</svg>'

p = os.path.join(ROOT, 'src', 'page-body.html'); s = open(p).read()
s, n = re.subn(r'<div class="lowpoly"><svg.*?</svg></div>', lambda m: f'<div class="lowpoly">{svg}</div>', s, count=1, flags=re.S)
assert n == 1
open(p, 'w').write(s)
p = os.path.join(ROOT, 'src', 'page-head.html'); s = open(p).read()
s = s.replace('.lowpoly svg { height: 56px; width: auto; }', '.lowpoly svg { height: 60px; width: auto; }')
s = s.replace('.lowpoly { flex: 1; min-width: 0; height: 56px;', '.lowpoly { flex: 1; min-width: 0; height: 60px;')
open(p, 'w').write(s)
print('ok', round(x), len(svg) // 1024, 'KB')
