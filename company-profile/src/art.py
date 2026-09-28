"""Isometric illustration helpers for the company-profile deck (outputs inline SVG strings)."""
import math

C30, S30 = math.cos(math.radians(30)), math.sin(math.radians(30))


class Iso:
    def __init__(self, s=10, ox=0, oy=0):
        self.s, self.ox, self.oy = s, ox, oy
        self.items = []  # (depth, svg)

    def p(self, x, y, z):
        return (self.ox + (x - y) * C30 * self.s, self.oy + (x + y) * S30 * self.s - z * self.s)

    def poly(self, pts, fill, stroke=None, sw=1, op=1, depth=0):
        d = " ".join(f"{a:.1f},{b:.1f}" for a, b in (self.p(*q) for q in pts))
        st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
        o = f' opacity="{op}"' if op != 1 else ""
        self.items.append((depth, f'<polygon points="{d}" fill="{fill}"{st}{o}/>'))

    def box(self, x, y, z, w, d, h, top, left, right, stroke=None, sw=1, depth=None):
        dep = depth if depth is not None else x + y + z
        self.poly([(x, y, z + h), (x + w, y, z + h), (x + w, y + d, z + h), (x, y + d, z + h)], top, stroke, sw, depth=dep)
        self.poly([(x, y + d, z), (x + w, y + d, z), (x + w, y + d, z + h), (x, y + d, z + h)], left, stroke, sw, depth=dep + 0.001)
        self.poly([(x + w, y, z), (x + w, y + d, z), (x + w, y + d, z + h), (x + w, y, z + h)], right, stroke, sw, depth=dep + 0.002)

    def win_left(self, x, y, z, w, d, h, rows, cols, fill, lit=(), lit_fill=None, mx=0.5, mz=0.6, depth=None):
        """Windows on the front-left face (plane y = y+d)."""
        dep = (depth if depth is not None else x + y + z) + 0.01
        cw, rh = (w - mx * (cols + 1)) / cols, (h - mz * (rows + 1)) / rows
        yy = y + d
        for r in range(rows):
            for c in range(cols):
                x0, z0 = x + mx + c * (cw + mx), z + mz + r * (rh + mz)
                f = lit_fill if (r, c) in lit else fill
                self.poly([(x0, yy, z0), (x0 + cw, yy, z0), (x0 + cw, yy, z0 + rh), (x0, yy, z0 + rh)], f, depth=dep)

    def win_right(self, x, y, z, w, d, h, rows, cols, fill, lit=(), lit_fill=None, my=0.5, mz=0.6, depth=None):
        """Windows on the front-right face (plane x = x+w)."""
        dep = (depth if depth is not None else x + y + z) + 0.01
        cw, rh = (d - my * (cols + 1)) / cols, (h - mz * (rows + 1)) / rows
        xx = x + w
        for r in range(rows):
            for c in range(cols):
                y0, z0 = y + my + c * (cw + my), z + mz + r * (rh + mz)
                f = lit_fill if (r, c) in lit else fill
                self.poly([(xx, y0, z0), (xx, y0 + cw, z0), (xx, y0 + cw, z0 + rh), (xx, y0, z0 + rh)], f, depth=dep)

    def cdu(self, x, y, z, pal, depth=None):
        """Rooftop condensing unit: small box with a fan ellipse on top."""
        dep = depth if depth is not None else x + y + z + 0.5
        self.box(x, y, z, 1.6, 1.2, 1.1, pal["cdu_t"], pal["cdu_l"], pal["cdu_r"], depth=dep)
        cx, cy = self.p(x + 0.8, y + 0.6, z + 1.1)
        self.items.append((dep + 0.01, f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{0.55*self.s:.1f}" ry="{0.3*self.s:.1f}" fill="{pal["fan"]}"/>'))

    def line(self, pts, color, sw=2, depth=999, dash=None):
        d = " ".join(f"{a:.1f},{b:.1f}" for a, b in (self.p(*q) for q in pts))
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.items.append((depth, f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"{da}/>'))

    def svg(self):
        return "".join(s for _, s in sorted(self.items, key=lambda t: t[0]))


DARK = dict(top="#2C528C", left="#1A3A6A", right="#12305B", win="#2D5796", lit="#F2A65A",
            cdu_t="#DCE5F2", cdu_l="#9FB3CF", cdu_r="#B9C8DD", fan="#5C7597", ground="#10294D",
            stroke="rgba(255,255,255,.10)")
LIGHT = dict(top="#FFFFFF", left="#DCE6F4", right="#C4D4EA", win="#9DB6DA", lit="#F2A65A",
             cdu_t="#FFFFFF", cdu_l="#C9D5E6", cdu_r="#AFC0D8", fan="#6D84A6", ground="#EEF2F8",
             stroke="#AFC0D8")


def cover_art():
    """City block: office tower, hospital, factory with sawtooth roof, rooftop CDUs and refrigerant risers."""
    P = DARK
    iso = Iso(s=22, ox=560, oy=470)
    st, sw = P["stroke"], 1.2
    # ground plate
    iso.poly([(-2, -2, 0), (30, -2, 0), (30, 26, 0), (-2, 26, 0)], P["ground"], depth=-100)
    # grid lines on the plate
    for i in range(-2, 31, 4):
        iso.line([(i, -2, 0), (i, 26, 0)], "rgba(255,255,255,.05)", 1, depth=-99)
    for j in range(-2, 27, 4):
        iso.line([(-2, j, 0), (30, j, 0)], "rgba(255,255,255,.05)", 1, depth=-99)

    # office tower (back)
    iso.box(2, 1, 0, 7, 7, 20, P["top"], P["left"], P["right"], st, sw)
    iso.win_left(2, 1, 0, 7, 7, 20, 11, 4, P["win"], lit={(3, 1), (7, 2), (9, 0), (5, 3)}, lit_fill=P["lit"])
    iso.win_right(2, 1, 0, 7, 7, 20, 11, 4, P["win"], lit={(2, 2), (8, 1)}, lit_fill=P["lit"])
    for i, (cx, cy) in enumerate([(3, 2), (5.4, 2), (3, 4.6), (5.4, 4.6)]):
        iso.cdu(cx, cy, 20, P)
    # riser on tower face
    iso.line([(9, 7.6, 20), (9, 7.6, 1)], "#EE7F1F", 3, depth=19.5)
    iso.line([(9, 6.9, 20), (9, 6.9, 1)], "#F6B679", 2, depth=19.5)

    # hospital (right)
    iso.box(13, 1, 0, 9, 7, 11, P["top"], P["left"], P["right"], st, sw)
    iso.win_left(13, 1, 0, 9, 7, 11, 5, 6, P["win"], lit={(1, 2), (3, 4)}, lit_fill=P["lit"])
    iso.win_right(13, 1, 0, 9, 7, 11, 5, 4, P["win"], lit={(2, 1)}, lit_fill=P["lit"])
    # red-cross sign on roof parapet (white plate + orange cross)
    iso.box(16.5, 3.5, 11, 2.2, 0.4, 2.2, "#E8EEF7", "#E8EEF7", "#C9D5E6", depth=40)
    cx, cy = iso.p(17.6, 3.9, 12.1)
    iso.items.append((40.1, f'<g transform="translate({cx:.1f},{cy:.1f})"><rect x="-6" y="-17" width="12" height="34" fill="#EE7F1F"/><rect x="-17" y="-6" width="34" height="12" fill="#EE7F1F"/></g>'))
    for cx_, cy_ in [(14, 5), (19.5, 5.2), (14, 2)]:
        iso.cdu(cx_, cy_, 11, P)

    # factory (front) with sawtooth roof
    iso.box(3, 13, 0, 18, 9, 6, P["top"], P["left"], P["right"], st, sw)
    iso.win_left(3, 13, 0, 18, 9, 6, 1, 8, P["win"], lit={(0, 3), (0, 6)}, lit_fill=P["lit"], mz=1.4)
    iso.win_right(3, 13, 0, 18, 9, 6, 1, 4, P["win"], mz=1.4)
    for k in range(4):
        x0 = 3 + k * 4.5
        dep = 3 + 13 + 6 + k * 0.1 + 1
        iso.poly([(x0, 13, 6), (x0, 22, 6), (x0, 22, 8.5), (x0, 13, 8.5)], "#3A63A3", st, sw, depth=dep)
        iso.poly([(x0, 13, 8.5), (x0 + 4.5, 13, 6), (x0 + 4.5, 22, 6), (x0, 22, 8.5)], P["top"], st, sw, depth=dep + 0.01)
        iso.poly([(x0, 22, 6), (x0 + 4.5, 22, 6), (x0, 22, 8.5)], P["left"], st, sw, depth=dep + 0.02)
    # ground-mounted CDUs beside factory
    for yy in (14, 16, 18):
        iso.cdu(23, yy, 0, P, depth=40 + yy)
    # pipe run from CDUs into factory wall
    iso.line([(23, 14.6, 0.9), (21.2, 14.6, 0.9), (21.2, 14.6, 4.5)], "#EE7F1F", 3, depth=60)
    iso.line([(23, 16.6, 0.9), (21.2, 16.6, 0.9), (21.2, 16.6, 4.5)], "#EE7F1F", 3, depth=60)
    iso.line([(23, 18.6, 0.9), (21.2, 18.6, 0.9), (21.2, 18.6, 4.5)], "#EE7F1F", 3, depth=60)
    return f'<svg viewBox="0 0 1100 1080" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{iso.svg()}</svg>'


def icon(kind):
    """Small light isometric building for case-study cards."""
    P = LIGHT
    iso = Iso(s=9, ox=150, oy=112)
    st = P["stroke"]
    iso.poly([(-1, -1, 0), (15, -1, 0), (15, 13, 0), (-1, 13, 0)], P["ground"], depth=-10)
    if kind == "factory":
        iso.box(0, 2, 0, 13, 8, 4, P["top"], P["left"], P["right"], st)
        iso.win_left(0, 2, 0, 13, 8, 4, 1, 6, P["win"], mz=1)
        for k in range(3):
            x0 = k * 4.33
            d = 20 + k
            iso.poly([(x0, 2, 4), (x0, 10, 4), (x0, 10, 6), (x0, 2, 6)], "#E3EBF6", st, depth=d)
            iso.poly([(x0, 2, 6), (x0 + 4.33, 2, 4), (x0 + 4.33, 10, 4), (x0, 10, 6)], P["top"], st, depth=d + .1)
            iso.poly([(x0, 10, 4), (x0 + 4.33, 10, 4), (x0, 10, 6)], P["left"], st, depth=d + .2)
        iso.cdu(13.6, 3, 0, P, depth=40); iso.cdu(13.6, 6, 0, P, depth=41)
    elif kind == "hospital":
        iso.box(1, 1, 0, 11, 8, 8, P["top"], P["left"], P["right"], st)
        iso.win_left(1, 1, 0, 11, 8, 8, 3, 6, P["win"])
        iso.win_right(1, 1, 0, 11, 8, 8, 3, 4, P["win"])
        cx, cy = iso.p(6.5, 5, 8)
        iso.items.append((50, f'<g transform="translate({cx:.1f},{cy:.1f})"><rect x="-3" y="-9" width="6" height="18" fill="#EE7F1F"/><rect x="-9" y="-3" width="18" height="6" fill="#EE7F1F"/></g>'))
        iso.cdu(2, 2, 8, P, depth=30); iso.cdu(9, 2, 8, P, depth=31)
    elif kind == "office":
        iso.box(3, 2, 0, 7, 7, 13, P["top"], P["left"], P["right"], st)
        iso.win_left(3, 2, 0, 7, 7, 13, 6, 4, P["win"])
        iso.win_right(3, 2, 0, 7, 7, 13, 6, 4, P["win"])
        iso.cdu(4, 3, 13, P, depth=40); iso.cdu(6.8, 5.5, 13, P, depth=41)
    elif kind == "plant":
        iso.box(0, 3, 0, 8, 7, 5, P["top"], P["left"], P["right"], st)
        iso.win_left(0, 3, 0, 8, 7, 5, 1, 4, P["win"], mz=1.2)
        for i, (x, y) in enumerate([(9.5, 3), (9.5, 7)]):
            iso.box(x, y, 0, 3, 3, 7, P["top"], P["left"], P["right"], st, depth=30 + i)
        iso.line([(8, 5, 3), (9.5, 5, 3)], "#EE7F1F", 2.5, depth=60)
        iso.cdu(1, 4, 5, P, depth=40)
    return f'<svg viewBox="0 0 300 245" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{iso.svg()}</svg>'


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w").write(cover_art())
