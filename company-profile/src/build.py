"""Assemble company-profile Rev02 index.html from template.html + generated SVG artwork."""
import math, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import art

SP = HERE + "/"
OUT = os.path.join(HERE, "..", "index.html")
NAVY, BLUE, ORANGE, INK, MUTED, LINE = "#0A2240", "#1257D6", "#EE7F1F", "#16202E", "#5A6679", "#DCE3EC"
FONT = 'font-family="IBM Plex Sans, IBM Plex Sans Thai, sans-serif"'


def mark(bg, fg):
    return (f'<svg class="mk" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" rx="8" fill="{bg}"/>'
            f'<g fill="none" stroke="{fg}" stroke-width="2.4" stroke-linecap="round"><path d="M8 12c4-3 7 3 11 0s5-2 7-1"/><path d="M8 18c4-3 7 3 11 0s5-2 7-1"/></g>'
            f'<path d="M8 24c4-3 7 3 11 0s5-2 7-1" fill="none" stroke="{ORANGE}" stroke-width="2.4" stroke-linecap="round"/></svg>')


def flow():
    """Airflow contour lines for dark slides."""
    paths = []
    for k in range(16):
        y = 120 + k * 60
        a = 40 + 8 * math.sin(k)
        d = f"M-50 {y} C 400 {y - a*3} 700 {y + a*4} 1100 {y + a} S 1700 {y - a*3} 1980 {y - a}"
        op = .05 + .03 * (k % 3)
        paths.append(f'<path d="{d}" stroke="rgba(255,255,255,{op:.2f})" stroke-width="1.5" fill="none"/>')
    paths.append(f'<path d="M-50 1050 C 400 990 700 1070 1100 1025 S 1700 960 1980 1000" stroke="{ORANGE}" stroke-opacity=".6" stroke-width="2.5" fill="none"/>')
    return ('<svg class="flow-bg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
            '<defs><radialGradient id="glow" cx="80%" cy="30%" r="60%"><stop offset="0" stop-color="#1D4C8F" stop-opacity=".7"/><stop offset="1" stop-color="#0A2240" stop-opacity="0"/></radialGradient></defs>'
            '<rect width="1920" height="1080" fill="url(#glow)"/>' + "".join(paths) + '</svg>')


def install():
    t = lambda x, y, s, size=20, w=600, fill=INK, anchor="start": f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{fill}" text-anchor="{anchor}" {FONT}>{s}</text>'
    def callout(n, cx, cy, tx, ty):
        return (f'<line x1="{cx}" y1="{cy}" x2="{tx}" y2="{ty}" stroke="{NAVY}" stroke-width="1.5"/><circle cx="{tx}" cy="{ty}" r="4" fill="{NAVY}"/>'
                f'<circle cx="{cx}" cy="{cy}" r="19" fill="{NAVY}"/>' + t(cx, cy + 7, n, 19, 700, "#fff", "middle"))
    g = []
    g.append('<defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#B7C3D4" stroke-width="3"/></pattern>'
             '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF1FC"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs>')
    g.append('<rect x="0" y="0" width="540" height="600" fill="#F7F9FC"/><rect x="580" y="0" width="300" height="600" fill="url(#sky)"/>')
    g.append('<rect x="540" y="0" width="40" height="600" fill="url(#hatch)"/><rect x="540" y="0" width="40" height="600" fill="none" stroke="#9FB0C8" stroke-width="1.5"/>')
    g.append(f'<line x1="0" y1="575" x2="540" y2="575" stroke="#9FB0C8" stroke-width="2"/><line x1="580" y1="575" x2="880" y2="575" stroke="#9FB0C8" stroke-width="2"/>')
    g.append(t(24, 36, "INDOOR · ภายในอาคาร", 16, 700, "#8A95A6") + t(598, 36, "OUTDOOR · ภายนอก", 16, 700, "#8A95A6"))
    # breaker + cable
    g.append(f'<path d="M160 300 V 190" stroke="{INK}" stroke-width="3" fill="none"/>')
    g.append(f'<rect x="118" y="300" width="84" height="112" rx="8" fill="#fff" stroke="{NAVY}" stroke-width="2"/><rect x="146" y="330" width="28" height="44" rx="4" fill="{BLUE}"/><rect x="152" y="336" width="16" height="16" rx="2" fill="#fff"/>')
    g.append(t(160, 438, "BREAKER", 14, 700, "#8A95A6", "middle"))
    # indoor unit
    g.append(f'<rect x="80" y="92" width="380" height="100" rx="16" fill="#fff" stroke="{NAVY}" stroke-width="2.5"/>'
             f'<line x1="104" y1="170" x2="436" y2="170" stroke="#9FB0C8" stroke-width="3" stroke-linecap="round"/><circle cx="420" cy="120" r="5" fill="{BLUE}"/>')
    g.append(t(270, 136, "FCU · คอยล์เย็น", 18, 700, NAVY, "middle"))
    # refrigerant pipes with insulation underlay
    route_a = "M460 124 H 612 V 402 H 668"
    route_b = "M460 140 H 598 V 420 H 668"
    g.append(f'<path d="{route_a}" stroke="#F6C99A" stroke-width="14" fill="none" stroke-linejoin="round"/><path d="{route_b}" stroke="#F6C99A" stroke-width="14" fill="none" stroke-linejoin="round"/>')
    g.append(f'<path d="{route_a}" stroke="#C85F10" stroke-width="4" fill="none" stroke-linejoin="round"/><path d="{route_b}" stroke="{ORANGE}" stroke-width="3" fill="none" stroke-linejoin="round"/>')
    # trunking outside
    g.append(f'<rect x="588" y="160" width="36" height="210" rx="4" fill="#fff" fill-opacity=".85" stroke="#8FA2BD" stroke-width="2"/>')
    # drain
    g.append(f'<path d="M440 192 L 560 224 L 640 224 V 548" stroke="{BLUE}" stroke-width="4" stroke-dasharray="10 7" fill="none" stroke-linecap="round"/><path d="M632 548 h16" stroke="{BLUE}" stroke-width="4"/>')
    g.append(t(470, 238, "ลาดเอียง", 15, 600, BLUE))
    # outdoor unit + bracket
    g.append(f'<path d="M580 504 H 862 M580 566 L 800 504" stroke="{NAVY}" stroke-width="6" stroke-linecap="round" fill="none"/>')
    g.append(f'<rect x="690" y="492" width="22" height="8" fill="{INK}"/><rect x="820" y="492" width="22" height="8" fill="{INK}"/>')
    g.append(f'<rect x="668" y="360" width="194" height="132" rx="10" fill="#fff" stroke="{NAVY}" stroke-width="2.5"/>'
             f'<circle cx="740" cy="426" r="48" fill="#EEF3FA" stroke="{NAVY}" stroke-width="2"/>'
             + "".join(f'<line x1="{740-44}" y1="{426+d}" x2="{740+44}" y2="{426+d}" stroke="#AFC0D8" stroke-width="1.5"/>' for d in (-24, -12, 0, 12, 24))
             + "".join(f'<line x1="{806}" y1="{384+k*14}" x2="{848}" y2="{384+k*14}" stroke="#AFC0D8" stroke-width="3" stroke-linecap="round"/>' for k in range(7)))
    g.append(t(765, 352, "CDU · คอยล์ร้อน", 18, 700, NAVY, "middle"))
    # dimension: standard 4 m
    g.append(f'<path d="M460 66 H 612" stroke="{MUTED}" stroke-width="1.5"/><path d="M460 58 v16 M612 58 v16" stroke="{MUTED}" stroke-width="1.5"/>' + t(536, 54, "ระยะมาตรฐาน 4 m", 15, 600, MUTED, "middle"))
    # callouts
    g.append(callout("1", 520, 96, 540, 124))
    g.append(callout("2", 690, 110, 612, 150))
    g.append(callout("3", 250, 300, 202, 340))
    g.append(callout("4", 700, 250, 640, 300))
    g.append(callout("5", 530, 330, 588, 300))
    g.append(callout("6", 760, 548, 730, 505))
    return f'<svg viewBox="0 0 880 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="แผนภาพมาตรฐานงานติดตั้งแอร์ติดผนัง">{"".join(g)}</svg>'


def flywheel():
    cx, cy, R = 410, 360, 245
    labels = [("ทำทะเบียนเครื่อง", "Asset Register"), ("ล้างและ PM", "ตามรอบ"), ("ตรวจพบ", "และจัดลำดับ"),
              ("ซ่อม", "ตามแผน"), ("เปลี่ยนเครื่อง", "เมื่อคุ้มค่า"), ("ต่อสัญญา", "วางแผนปีถัดไป")]
    cols = [NAVY, BLUE, BLUE, ORANGE, ORANGE, NAVY]
    g = [f'<defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9FB0C8"/></marker></defs>']
    g.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="#E3E9F2" stroke-width="26"/>')
    n = len(labels)
    for k in range(n):
        a0 = math.radians(-90 + k * 60 + 17)
        a1 = math.radians(-90 + (k + 1) * 60 - 17)
        x0, y0 = cx + R * math.cos(a0), cy + R * math.sin(a0)
        x1, y1 = cx + R * math.cos(a1), cy + R * math.sin(a1)
        g.append(f'<path d="M{x0:.1f} {y0:.1f} A{R} {R} 0 0 1 {x1:.1f} {y1:.1f}" fill="none" stroke="#9FB0C8" stroke-width="3" marker-end="url(#ah)"/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="150" fill="{NAVY}"/>')
    g.append(f'<text x="{cx}" y="{cy-12}" font-size="42" font-weight="700" fill="#fff" text-anchor="middle" {FONT}>PM / AMC</text>')
    g.append(f'<text x="{cx}" y="{cy+30}" font-size="22" fill="rgba(255,255,255,.75)" text-anchor="middle" {FONT}>วงจรดูแลระบบของลูกค้า</text>')
    for k, ((a, b), c) in enumerate(zip(labels, cols)):
        ang = math.radians(-90 + k * 60)
        x, y = cx + R * math.cos(ang), cy + R * math.sin(ang)
        g.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="40" fill="#fff" stroke="{c}" stroke-width="4"/>')
        g.append(f'<text x="{x:.1f}" y="{y+10:.1f}" font-size="28" font-weight="700" fill="{c}" text-anchor="middle" {FONT}>0{k+1}</text>')
        lx, ly = cx + (R + 70) * math.cos(ang), cy + (R + 70) * math.sin(ang)
        anchor = "middle" if abs(math.cos(ang)) < .2 else ("start" if math.cos(ang) > 0 else "end")
        if anchor != "middle":
            lx = x + (52 if anchor == "start" else -52)
            ly = y - 8
        elif ly < cy:
            ly = y - 86
        else:
            ly = y + 70
        g.append(f'<text x="{lx:.1f}" y="{ly:.1f}" font-size="24" font-weight="700" fill="{NAVY}" text-anchor="{anchor}" {FONT}>{a}</text>')
        g.append(f'<text x="{lx:.1f}" y="{ly+30:.1f}" font-size="20" fill="{MUTED}" text-anchor="{anchor}" {FONT}>{b}</text>')
    return f'<svg viewBox="0 0 820 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="วงจรบริการ PM/AMC">{"".join(g)}</svg>'


def zone():
    g = []
    t = lambda x, y, s, size=18, w=600, fill=INK, anchor="start": f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{fill}" text-anchor="{anchor}" {FONT}>{s}</text>'
    g.append('<defs><pattern id="wip" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#FCEBDC"/><line x1="0" y1="0" x2="0" y2="12" stroke="#F6B679" stroke-width="5"/></pattern></defs>')
    g.append(t(0, 26, "ตัวอย่างแผนงานแบ่งโซน · ZONE PLAN", 18, 700, "#8A95A6"))
    X, Y, W, H = 0, 50, 780, 380
    g.append(f'<rect x="{X}" y="{Y}" width="{W}" height="{H}" rx="6" fill="#fff" stroke="{NAVY}" stroke-width="3"/>')
    zones = [("A", X + 10, Y + 10, 370, 165, "#DCE6F4", "เสร็จแล้ว"), ("B", X + 400, Y + 10, 370, 165, "url(#wip)", "กำลังทำ"),
             ("C", X + 10, Y + 205, 370, 165, "#F4F6FA", "รอคิว"), ("D", X + 400, Y + 205, 370, 165, "#F4F6FA", "รอคิว")]
    g.append(f'<rect x="{X+10}" y="{Y+180}" width="{W-20}" height="20" fill="#EEF1F6"/>' + t(W / 2, Y + 195, "ทางเดิน / พื้นที่ใช้งานปกติ", 13, 600, "#8A95A6", "middle"))
    for name, x, y, w, h, fill, st in zones:
        g.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{fill}" stroke="#AFC0D8" stroke-width="1.5"/>')
        g.append(t(x + 18, y + 40, f"โซน {name}", 24, 700, NAVY) + t(x + w - 16, y + 36, st, 16, 700, ORANGE if st == "กำลังทำ" else (BLUE if st == "เสร็จแล้ว" else "#8A95A6"), "end"))
        for r in range(2):
            for c in range(4):
                ux, uy = x + 40 + c * 82, y + 70 + r * 48
                fillu = NAVY if st == "เสร็จแล้ว" else (ORANGE if (st == "กำลังทำ" and (r * 4 + c) < 5) else "#fff")
                g.append(f'<rect x="{ux}" y="{uy}" width="36" height="36" rx="4" fill="{fillu}" stroke="{NAVY}" stroke-width="1.5"/><circle cx="{ux+18}" cy="{uy+18}" r="7" fill="none" stroke="{"#fff" if fillu != "#fff" else "#AFC0D8"}" stroke-width="1.5"/>')
    # night-shift timeline
    ty = 470
    g.append(t(0, ty, "ตารางทำงานกะกลางคืน 20:00 – 06:00", 18, 700, "#8A95A6"))
    for k, (nm, c) in enumerate([("คืนที่ 1 · โซน A", NAVY), ("คืนที่ 2 · โซน B", ORANGE), ("คืนที่ 3 · โซน C", "#9FB0C8"), ("คืนที่ 4 · โซน D", "#9FB0C8")]):
        x = k * 197
        g.append(f'<rect x="{x}" y="{ty+16}" width="185" height="46" rx="8" fill="{c}"/>' + t(x + 92, ty + 46, nm, 17, 700, "#fff", "middle"))
    g.append(t(0, ty + 96, "สี่เหลี่ยม = เครื่องแต่ละหน่วยในโซน · ปิดพื้นที่ทีละโซน ส่งมอบก่อนเริ่มเวลาทำงานของลูกค้า", 16, 500, MUTED))
    return f'<svg viewBox="0 0 780 580" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ตัวอย่างแผนงานแบ่งโซน">{"".join(g)}</svg>'


def cmap():
    cx, cy = 440, 400
    g = []
    t = lambda x, y, s, size=19, w=600, fill=INK, anchor="start": f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{fill}" text-anchor="{anchor}" {FONT}>{s}</text>'
    g.append(f'<circle cx="{cx}" cy="{cy}" r="345" fill="#FEF6EE" stroke="{ORANGE}" stroke-width="2" stroke-dasharray="8 8"/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="235" fill="#EEF4FD" stroke="{BLUE}" stroke-width="2"/>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="115" fill="#DCE6F4" stroke="{NAVY}" stroke-width="2"/>')
    g.append(t(cx, cy - 345 + 30, "งานโครงการต่างจังหวัด", 17, 700, "#B35A0C", "middle"))
    g.append(t(cx, cy - 235 + 30, "กรุงเทพฯ และปริมณฑล", 17, 700, BLUE, "middle"))
    g.append(t(cx, cy - 115 + 28, "พื้นที่หลัก", 17, 700, NAVY, "middle"))
    # schematic river line
    g.append(f'<path d="M{cx+30} 40 C {cx+70} 200 {cx-10} 300 {cx+60} {cy} S {cx+150} 620 {cx+120} 760" stroke="#9CC0F0" stroke-width="10" fill="none" opacity=".55" stroke-linecap="round"/>')
    pts = [(cx - 40, cy + 62, "บางมด", "start", NAVY), (cx + 70, cy + 40, "ราษฎร์บูรณะ", "start", NAVY), (cx + 92, cy - 34, "พระประแดง", "start", NAVY),
           (cx + 110, cy - 165, "ลาดพร้าว", "start", BLUE), (cx - 120, cy - 160, "นนทบุรี", "end", BLUE), (cx - 190, cy + 90, "สมุทรสาคร", "end", BLUE),
           (cx + 200, cy + 60, "สมุทรปราการ", "start", BLUE), (cx - 318, cy - 40, "กาญจนบุรี", "end", ORANGE), (cx + 240, cy + 230, "นิคมฯ ภาคตะวันออก", "end", ORANGE)]
    for x, y, nm, anc, c in pts:
        g.append(f'<circle cx="{x}" cy="{y}" r="9" fill="{c}" stroke="#fff" stroke-width="3"/>')
        g.append(t(x + (16 if anc == "start" else -16), y + 7, nm, 19, 600, INK, anc))
    # HQ pin
    g.append(f'<g transform="translate({cx},{cy})"><circle r="26" fill="{ORANGE}" opacity=".25"/><path d="M0 -34 C 18 -34 26 -20 26 -10 C 26 8 0 26 0 26 C 0 26 -26 8 -26 -10 C -26 -20 -18 -34 0 -34z" fill="{ORANGE}" transform="translate(0,-18)"/><circle cy="-28" r="9" fill="#fff"/></g>')
    g.append(t(cx, cy + 38, "สำนักงาน พระราม 2", 19, 700, NAVY, "middle"))
    # north arrow + note
    g.append(f'<g transform="translate(830,60)"><path d="M0 -26 L10 10 L0 3 L-10 10z" fill="{NAVY}"/>{t(0, 36, "N", 16, 700, NAVY, "middle")}</g>')
    g.append(t(10, 790, "แผนภาพแสดงพื้นที่โดยประมาณ ไม่ใช่มาตราส่วน", 16, 500, "#8A95A6"))
    return f'<svg viewBox="0 0 900 800" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="แผนภาพพื้นที่ให้บริการ">{"".join(g)}</svg>'


def ac_unit():
    return ('<svg viewBox="0 0 520 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
            '<defs><linearGradient id="acg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4EAF3"/></linearGradient></defs>'
            '<ellipse cx="260" cy="232" rx="210" ry="10" fill="#0A2240" opacity=".08"/>'
            '<rect x="40" y="40" width="440" height="120" rx="26" fill="url(#acg)" stroke="#AFC0D8" stroke-width="2"/>'
            '<path d="M58 132 H 462" stroke="#C9D5E6" stroke-width="2"/><path d="M70 146 Q 260 162 450 146" stroke="#8FA2BD" stroke-width="5" fill="none" stroke-linecap="round"/>'
            '<rect x="386" y="62" width="64" height="24" rx="6" fill="#0A2240"/><text x="418" y="80" font-size="15" font-weight="700" fill="#7FB0FF" text-anchor="middle" font-family="IBM Plex Sans, sans-serif">24°C</text>'
            f'<text x="70" y="86" font-size="22" font-weight="700" fill="{NAVY}" letter-spacing="3" font-family="IBM Plex Sans, sans-serif">FUJIVA</text>'
            f'<text x="70" y="108" font-size="13" font-weight="600" fill="{MUTED}" letter-spacing="2" font-family="IBM Plex Sans, sans-serif">DC INVERTER · R32</text>'
            + "".join(f'<path d="M{110+k*75} 176 q 14 18 0 36 q -14 18 0 34" stroke="{BLUE}" stroke-opacity="{.55-k*.08:.2f}" stroke-width="3" fill="none" stroke-linecap="round"/>' for k in range(5))
            + '</svg>')


def spray():
    return ('<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
            '<defs><linearGradient id="can" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0A2240"/><stop offset=".45" stop-color="#1D4C8F"/><stop offset="1" stop-color="#0A2240"/></linearGradient></defs>'
            '<ellipse cx="170" cy="244" rx="80" ry="8" fill="#0A2240" opacity=".1"/>'
            '<rect x="118" y="80" width="104" height="160" rx="16" fill="url(#can)"/>'
            '<path d="M128 80 q 42 -26 84 0" fill="#C9D5E6"/><rect x="152" y="36" width="36" height="34" rx="6" fill="#DCE5F2" stroke="#9FB0C8" stroke-width="2"/>'
            f'<rect x="188" y="44" width="26" height="10" rx="3" fill="#9FB0C8"/>'
            f'<rect x="118" y="140" width="104" height="46" fill="{ORANGE}"/>'
            '<text x="170" y="160" font-size="14" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing="2" font-family="IBM Plex Sans, sans-serif">FUJIVA</text>'
            '<text x="170" y="178" font-size="11" font-weight="600" fill="#fff" text-anchor="middle" letter-spacing="1" font-family="IBM Plex Sans, sans-serif">AIR FOAM</text>'
            '<text x="170" y="214" font-size="11" font-weight="600" fill="#9CC0F0" text-anchor="middle" letter-spacing="1" font-family="IBM Plex Sans, sans-serif">BLUE OCEAN</text>'
            + "".join(f'<circle cx="{230+x}" cy="{49+y}" r="{r}" fill="#9CC0F0" opacity="{o}"/>' for x, y, r, o in [(20, -4, 5, .8), (40, 6, 7, .6), (62, -10, 6, .5), (70, 18, 9, .4), (98, 0, 8, .35), (110, 28, 11, .25), (130, -14, 7, .25), (146, 16, 12, .18)])
            + '</svg>')


CLIENTS = [
    ("อุตสาหกรรมและโรงงาน", "M2 20V10l6 4V10l6 4V6h8v14z", "", [
        ("srithai", "ศรีไทยซุปเปอร์แวร์", 1), ("bbgi", "BBGI", 1), ("tman", "ที.แมน ฟาร์มาซูติคอล", 1), ("tt-technoplas", "ที ที เทคโนพลาส", 0),
        ("mitmongkol", "อุตสาหกรรมมิตรมงคล", 0),]),
    ("ยานยนต์ องค์กร และธุรกิจ", "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-4h4v4", "", [
        ("charoenthai-motor", "เจริญไทยมอเตอร์ เซลส์", 1), ("bp-lab", "บี พี แล็ป", 0), ("ekyongwong", "เอกยงวงศ์", 0), ("liger", "มิตซูบิชิ ไลเกอร์", 0),
        ("thanakul", "ธนกูล เวิร์คกรุ๊ป", 0)]),
    ("การแพทย์และการศึกษา", "M3 3h18v18H3zM12 8v8M8 12h8", " o", [
        ("paolo", "โรงพยาบาลเปาโล", 1), ("suksawat", "รพ.สุขสวัสดิ์อินเตอร์", 1), ("bangmod-aesthetic", "รพ.บางมด เอสเทติก", 0), ("smile-plus", "Smile Plus Dental", 0), ("bangmod-school", "โรงเรียนบางมดวิทยา", 0)]),
    ("ร้านอาหาร ค้าปลีก และบริการ", "M4 3v8a3 3 0 0 0 3 3v7M7 3v5M10 3v8a3 3 0 0 1-3 3M17 21V3c-2 0-3 3-3 7h3", " o", [
        ("nuea-luan", "เนื้อล้วนล้วน", 0), ("pen-lao", "เป็นลาว", 0), ("petchyindee", "เพชรยินดี อะคาเดมี", 0),]),
    ("ที่อยู่อาศัยและอาคารชุด", "M3 21V8l9-5 9 5v13M9 21v-6h6v6", "", [
        ("the-excel", "The Excel", 0), ("pleno", "หมู่บ้านพลีโน่", 0), ("the-pavilla", "The Pavilla", 0), ("bangmod-dorm", "หอพัก รพ.บางมด", 0)]),
]
ASSETS = os.path.join(HERE, "..", "assets") + "/"


def asset(sub, slug):
    import os
    for ext in ("svg", "png", "webp", "jpg"):
        if os.path.exists(f"{ASSETS}{sub}/{slug}.{ext}"):
            return f"assets/{sub}/{slug}.{ext}"
    return None


FEATURED = [
    ("tman", "T.MAN", "ที.แมน ฟาร์มาซูติคอล", "ผู้ผลิตและจำหน่ายยาและผลิตภัณฑ์สุขภาพกว่า 50 ปี", "บริษัทจดทะเบียนใน SET", "", ["ล้าง", "PM"]),
    ("srithai", "Srithai Superware", "ศรีไทยซุปเปอร์แวร์", "ผู้ผลิตภาชนะเมลามีนรายใหญ่ระดับโลก ส่งออกกว่า 100 ประเทศ", "บริษัทจดทะเบียนใน SET", "", ["ล้าง", "PM", "ซ่อม", "ติดตั้ง"]),
    ("bbgi", "BBGI", "บีบีจีไอ", "ธุรกิจผลิตภัณฑ์ชีวภาพและเชื้อเพลิงชีวภาพ ในกลุ่มบางจาก", "บริษัทจดทะเบียนใน SET", "", ["ติดตั้ง", "ซ่อม", "PM"]),
    ("charoenthai-motor", "Charoen Thai Motor Sales", "เจริญไทยมอเตอร์ เซลส์", "ผู้แทนจำหน่ายรถยนต์โตโยต้าอย่างเป็นทางการ ตั้งแต่ปี 2508", "Toyota Dealer", " o", ["PM", "ซ่อม", "ติดตั้ง"]),
    ("paolo", "Paolo Hospital", "โรงพยาบาลเปาโล พระประแดง", "โรงพยาบาลในเครือกรุงเทพดุสิตเวชการ (BDMS)", "BDMS Network", " o", ["ล้างตามแผน"]),
    ("tt-technoplas", "T.T. Technoplast", "ที ที เทคโนพลาส", "ผู้ผลิตของเล่น ผลิตภัณฑ์พลาสติก และเมลามีน", "Manufacturer", " o", ["ติดตั้ง", "ซ่อม"]),
]


def featured():
    cards = []
    for slug, en, th, desc, badge, tone, svc in FEATURED:
        src = asset("clients", slug)
        lg = f'<img src="{src}" alt="{th}">' if src else f"<b>{en}</b>"
        chips = "".join(f"<span>{x}</span>" for x in svc)
        cards.append(f'<div class="card"><div class="lg">{lg}</div><div class="bd"><h3>{th}</h3><p>{desc}</p><span class="badge{tone}">{badge}</span><div class="sv">{chips}</div></div></div>')
    return f'<div class="body fc" style="margin-top:34px">{"".join(cards)}</div>'


def client_wall():
    tiles = []
    for _title, _icon, _tone, items in CLIENTS:
        for slug, name, _key in items:
            src = asset("clients", slug)
            if not src:
                continue  # only clients with a published logo appear on the wall
            tiles.append(f'<div class="tile"><div class="lg"><img src="{src}" alt="{name}"></div><span class="nm">{name}</span></div>')
    return f'<div class="body lw">{"".join(tiles)}</div>'


# Project reference list: scope from the job register (types only, no counts)
CH = {"i": "ติดตั้ง", "c": "ล้าง", "p": "PM", "r": "ซ่อม"}
REF1 = [("อุตสาหกรรมและโรงงาน", [
    ("srithai", "ศรีไทยซุปเปอร์แวร์", "โรงงานผลิตภาชนะเมลามีน", "icpr", "สัญญาล้างแอร์ทั้งโรงงาน ซ่อมบอร์ดคอยล์ร้อน ติดตั้งเพิ่ม"),
    ("tman", "ที.แมน ฟาร์มาซูติคอล", "โรงงานยาและสำนักงาน", "cp", "ล้าง Cassette ตามใบสั่งงานรายเดือน"),
    ("bbgi", "BBGI", "โรงงานเชื้อเพลิงชีวภาพ", "irp", "ติดตั้ง 3 ชั้น เดินท่อบนฝ้า ซ่อมระบบห้องควบคุม"),
    ("tt-technoplas", "ที ที เทคโนพลาส", "โรงงานผลิตภัณฑ์พลาสติก", "ir", "แอร์แขวนและติดผนัง ตรวจเช็กหลังติดตั้ง"),
    ("mitmongkol", "อุตสาหกรรมมิตรมงคล", "โรงงานอุตสาหกรรม", "ir", "แอร์แขวนขนาดใหญ่ ซ่อมรอยรั่วห้องควบคุม"),
    ("ekyongwong", "เอกยงวงศ์", "โรงงานผลิตภัณฑ์การเกษตร", "cr", "ล้างรายปี แก้ไขน้ำหยดในโรงงาน")]),
  ("ยานยนต์ องค์กร และธุรกิจ", [
    ("charoenthai-motor", "เจริญไทยมอเตอร์ เซลส์", "โชว์รูมและศูนย์บริการ Toyota", "iprc", "Cassette ติดผนัง ตู้ตั้ง แขวน ตามสัญญา PM"),
    ("liger", "มิตซูบิชิ ไลเกอร์", "โชว์รูมและศูนย์บริการ", "c", "ล้างแอร์ติดผนัง แขวน และตู้ตั้ง"),
    ("bp-lab", "บี พี แล็ป", "โรงงานผลิตเครื่องสำอาง", "irc", "Fujiva 24,000 BTU แอร์แขวน เปลี่ยนมอเตอร์คอยล์เย็น"),
    ("thanakul", "ธนกูล เวิร์คกรุ๊ป", "ออกแบบและผลิตงานตกแต่ง", "i", "ติดตั้ง Fujiva ติดผนัง")])]
REF2 = [("การแพทย์และการศึกษา", [
    ("paolo", "โรงพยาบาลเปาโล", "โรงพยาบาลในเครือ BDMS", "c", "ล้างตามแผน ทำงานนอกเวลา (กลางคืน)"),
    ("suksawat", "รพ.สุขสวัสดิ์อินเตอร์", "โรงพยาบาลเอกชน", "i", "Carrier หลายขนาด BTU แยกขอบเขตเครื่อง ติดตั้ง และไฟฟ้า"),
    ("bangmod-aesthetic", "รพ.บางมด เอสเทติก", "โรงพยาบาลความงาม", "c", "ล้างเครื่องปรับอากาศ"),
    ("smile-plus", "Smile Plus Dental", "คลินิกทันตกรรม", "c", "ล้าง 4 ทิศทางและติดผนัง"),
    ("bangmod-school", "โรงเรียนบางมดวิทยา", "โรงเรียน", "i", "แอร์แขวนห้องประชุม 36,000 BTU")]),
  ("ร้านอาหาร และบริการ", [
    ("nuea-luan", "เนื้อล้วนล้วน", "ร้านอาหาร", "ic", "4 ทิศทางและติดผนัง เดินท่อและเข้าระบบ"),
    ("pen-lao", "เป็นลาว", "ร้านอาหาร", "rc", "ซ่อมมอเตอร์คอยล์เย็นและเซ็นเซอร์ 4 ทิศทาง"),
    ("petchyindee", "เพชรยินดี อะคาเดมี", "ยิมมวยไทย", "cr", "ล้างรายปี แก้ไขท่อน้ำทิ้ง")]),
  ("ที่อยู่อาศัยและอาคารชุด", [
    ("the-excel", "The Excel ลาดพร้าว", "คอนโดมิเนียม", "c", "ล้างแอร์ 4 ทิศทาง"),
    ("pleno", "หมู่บ้านพลีโน่", "หมู่บ้านจัดสรร", "ic", "ติดผนัง เปลี่ยนเครื่องใหม่"),
    ("the-pavilla", "The Pavilla", "บ้านเดี่ยว", "ic", "4 ทิศทาง Inverter พร้อมแนวท่อน้ำทิ้งใหม่"),
    ("bangmod-dorm", "หอพัก รพ.บางมด", "หอพัก", "i", "ติดตั้ง Fujiva ติดผนัง")])]


def reflist(groups, cls=""):
    rows = []
    for g, items in groups:
        rows.append(f'<tr class="grp"><td colspan="4">{g}</td></tr>')
        for slug, name, place, scope, detail in items:
            src = asset("clients", slug)
            logo = f'<i><img src="{src}" alt=""></i>' if src else "<i></i>"
            chips = "".join(f'<span class="chip {k}">{CH[k]}</span>' for k in scope)
            rows.append(f'<tr><td><div class="cl">{logo}{name}</div></td><td>{place}</td><td>{chips}</td><td>{detail}</td></tr>')
    head = '<tr><th style="width:470px">ลูกค้า</th><th style="width:330px">ประเภทสถานที่</th><th style="width:300px">ขอบเขตงาน</th><th>รายละเอียดงาน</th></tr>'
    return f'<table class="rt{cls}">{head}{"".join(rows)}</table>'


def fontface():
    src = open(os.path.join(HERE, "..", "archive", "Rev01", "index.html"), encoding="utf-8").read()
    lines = [l.replace("../../fonts/", "fonts/") for l in src.splitlines() if "@font-face" in l or "bundled locally" in l]
    return "\n".join(lines)


s = open(SP + "template.html", encoding="utf-8").read()
s = s.replace("{{FONTFACE}}", fontface())
s = s.replace("{{COVER}}", art.cover_art()).replace("{{FLOW}}", flow()).replace("{{INSTALL}}", install())
s = s.replace("{{CLIENT_WALL}}", client_wall()).replace("{{FEATURED}}", featured())
s = s.replace("{{REFLIST1}}", reflist(REF1, " roomy")).replace("{{REFLIST2}}", reflist(REF2))
s = s.replace("{{AC}}", ac_unit()).replace("{{SPRAY}}", spray())
s = s.replace("{{FLYWHEEL}}", flywheel()).replace("{{ZONE}}", zone()).replace("{{MAP}}", cmap())
_logo = asset("brand", "sbp-logo")
if _logo:
    _logo_w = asset("brand", "sbp-logo-white") or _logo
    s = s.replace("{{MARK_W}}", f'<img class="mk" src="{_logo_w}" alt="SP" style="height:42px;width:auto">').replace("{{MARK_N}}", f"<img class='mk' src='{_logo}' alt='SP' style='height:42px;width:auto'>")
else:
    s = s.replace("{{MARK_W}}", mark("#FFFFFF", NAVY)).replace("{{MARK_N}}", mark(NAVY, "#FFFFFF").replace('"', "'"))
s = re.sub(r"\{\{ICON:(\w+)\}\}", lambda m: art.icon(m.group(1)), s)
assert "{{" not in s, re.findall(r"\{\{[^}]+\}\}", s)
open(OUT, "w", encoding="utf-8").write(s)
print("written", len(s))
