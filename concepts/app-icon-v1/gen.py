import random, os
OUT = "/home/user/Bioconnect/concepts/app-icon-v1"
LINE = "#7a5a4c"

def grass(y0, h, step, color, seed, jitter=0.5):
    r = random.Random(seed)
    d = f"M-10 520 L-10 {y0}"
    x = -10
    while x < 530:
        tip = y0 - h * (1 - jitter + jitter * r.random())
        lean = r.uniform(-8, 8)
        d += f" Q{x+step*0.35:.1f} {y0-h*0.3:.1f} {x+step/2+lean:.1f} {tip:.1f} Q{x+step*0.65:.1f} {y0-h*0.3:.1f} {x+step:.1f} {y0}"
        x += step
    d += " L530 520 Z"
    return f'<path d="{d}" fill="{color}"/>'

def rabbit(eyes="calm", ear_flop=False, fur="#fbf3e6", inner="#f4a7b4"):
    right_ear = (f'<g transform="rotate(14 312 210)"><ellipse cx="312" cy="120" rx="40" ry="108" fill="{fur}" stroke="{LINE}" stroke-width="7"/>'
                 f'<ellipse cx="312" cy="128" rx="20" ry="80" fill="{inner}"/></g>')
    if ear_flop:
        right_ear = (f'<g transform="rotate(62 300 205)"><ellipse cx="300" cy="125" rx="40" ry="95" fill="{fur}" stroke="{LINE}" stroke-width="7"/>'
                     f'<ellipse cx="300" cy="132" rx="20" ry="68" fill="{inner}"/></g>')
    if eyes == "googly":
        eye = lambda cx, px, py: (f'<circle cx="{cx}" cy="288" r="27" fill="#fff" stroke="{LINE}" stroke-width="6"/>'
                                  f'<circle cx="{cx+px}" cy="{288+py}" r="13" fill="#231a1a"/>')
        face_eyes = eye(203, 7, 8) + eye(309, -9, -6)
    else:
        eye = lambda cx: (f'<ellipse cx="{cx}" cy="290" rx="16" ry="22" fill="#3a2826"/>'
                          f'<circle cx="{cx+5}" cy="281" r="6" fill="#fff"/><circle cx="{cx-5}" cy="298" r="2.6" fill="#fff"/>')
        face_eyes = eye(205) + eye(307)
    return f'''
  <ellipse cx="256" cy="500" rx="155" ry="120" fill="{fur}" stroke="{LINE}" stroke-width="7"/>
  <g transform="rotate(-14 200 210)"><ellipse cx="200" cy="120" rx="40" ry="108" fill="{fur}" stroke="{LINE}" stroke-width="7"/>
    <ellipse cx="200" cy="128" rx="20" ry="80" fill="{inner}"/></g>
  {right_ear}
  <ellipse cx="256" cy="305" rx="132" ry="116" fill="{fur}" stroke="{LINE}" stroke-width="7"/>
  <ellipse cx="176" cy="338" rx="22" ry="13" fill="#f6a6a6" opacity=".55"/>
  <ellipse cx="336" cy="338" rx="22" ry="13" fill="#f6a6a6" opacity=".55"/>
  {face_eyes}
  <path d="M243 320 Q256 312 269 320 Q262 333 256 334 Q250 333 243 320 Z" fill="#ec7f93"/>
  <path d="M256 334 V344 M256 344 Q246 356 234 350 M256 344 Q266 356 278 350" fill="none" stroke="{LINE}" stroke-width="5" stroke-linecap="round"/>
'''

def pumpkin(cx, cy, s, face=True, glow="#ffd36b"):
    f = ""
    if face:
        f = (f'<path d="M{cx-18*s} {cy-4*s} l8 {-12*s} l8 {12*s} Z M{cx+2*s} {cy-4*s} l8 {-12*s} l8 {12*s} Z" fill="{glow}"/>'
             f'<path d="M{cx-20*s} {cy+8*s} Q{cx} {cy+24*s} {cx+20*s} {cy+8*s} l-6 4 -5 -4 -5 4 -5 -4 -5 4 -5 -4 -5 4 Z" fill="{glow}"/>')
    return (f'<g><path d="M{cx} {cy-28*s} q2 {-14*s} {10*s} {-18*s}" stroke="#4f6b2a" stroke-width="{6*s}" fill="none" stroke-linecap="round"/>'
            f'<ellipse cx="{cx-14*s}" cy="{cy}" rx="{22*s}" ry="{28*s}" fill="#e8742a" stroke="#8a3b12" stroke-width="{4*s}"/>'
            f'<ellipse cx="{cx+14*s}" cy="{cy}" rx="{22*s}" ry="{28*s}" fill="#e8742a" stroke="#8a3b12" stroke-width="{4*s}"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{20*s}" ry="{29*s}" fill="#f58a36" stroke="#8a3b12" stroke-width="{4*s}"/>{f}</g>')

def bat(x, y, s, c="#1c1428"):
    return (f'<path transform="translate({x} {y}) scale({s})" d="M0 0 Q-10 -12 -28 -8 Q-22 -2 -24 6 Q-16 0 -10 6 Q-6 0 0 6 Q6 0 10 6 Q16 0 24 6 Q22 -2 28 -8 Q10 -12 0 0 Z" fill="{c}"/>')

def wrap(defs, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><clipPath id="sq"><rect width="512" height="512" rx="112"/></clipPath>{defs}</defs>
<g clip-path="url(#sq)">{body}</g></svg>'''


RAB = '<image href="rabbit-cutout.png" x="{x}" y="{y}" width="{w}" height="{h}"/>'
def rab(x=46, y=58, w=430):
    return RAB.format(x=x, y=y, w=w, h=round(w*784/754))

# A: Moonlit meadow
A = wrap('''<linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241a3e"/><stop offset="1" stop-color="#55407a"/></linearGradient>
<radialGradient id="moonA"><stop offset=".72" stop-color="#fbe9a6"/><stop offset=".78" stop-color="#fbe9a6" stop-opacity=".35"/><stop offset="1" stop-color="#fbe9a6" stop-opacity="0"/></radialGradient>''',
f'''<rect width="512" height="512" fill="url(#skyA)"/>
<circle cx="300" cy="200" r="210" fill="url(#moonA)"/>
<circle cx="60" cy="70" r="3" fill="#fff8"/><circle cx="470" cy="60" r="3" fill="#fff8"/><circle cx="40" cy="250" r="2.5" fill="#fff6"/><circle cx="485" cy="300" r="2.5" fill="#fff6"/>
{bat(80,120,1.3)}{bat(110,60,0.8)}
{grass(455, 70, 30, "#2e5a2c", 1)}
{rab()}
{grass(500, 55, 26, "#3f7a35", 2)}
{pumpkin(70, 460, 1.3)}{pumpkin(446, 468, 1.05)}
{grass(530, 40, 22, "#56963f", 3)}''')

# B: Pumpkin patch at dusk, big jack-o-lantern by the rabbit's nose
B = wrap('''<linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b2c6f"/><stop offset=".55" stop-color="#e2683a"/><stop offset="1" stop-color="#ffb357"/></linearGradient>''',
f'''<rect width="512" height="512" fill="url(#skyB)"/>
{bat(80,95,1.4,"#2a1430")}{bat(150,50,0.9,"#2a1430")}{bat(455,60,1.1,"#2a1430")}
{grass(430, 60, 34, "#3d6b2a", 4)}
{rab(x=20, y=58, w=420)}
{pumpkin(430, 440, 1.7)}
{pumpkin(70, 478, 1.0, face=False)}
{grass(520, 45, 24, "#5aa640", 5)}''')

# C: Cozy Eldritch (matches the game's current default skin)
def peek(x, y, s, look=0):
    return (f'<g transform="translate({x} {y}) scale({s})"><ellipse rx="16" ry="10" fill="#f4eccf"/>'
            f'<circle cx="{look}" r="6" fill="#1a1010"/><circle cx="{look+2}" cy="-2" r="1.8" fill="#fff"/></g>')
C = wrap('''<radialGradient id="bgC" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#2f4024"/><stop offset="1" stop-color="#0e130c"/></radialGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#a8c66c" stop-opacity=".28"/><stop offset="1" stop-color="#a8c66c" stop-opacity="0"/></radialGradient>''',
f'''<rect width="512" height="512" fill="url(#bgC)"/>
<circle cx="270" cy="290" r="240" fill="url(#halo)"/>
<circle cx="90" cy="90" r="44" fill="#ece4c8" opacity=".9"/><circle cx="110" cy="78" r="40" fill="#24321c"/>
<path d="M530 250 C470 240 470 175 430 160 C400 150 390 182 410 188 C428 194 424 170 410 172" fill="none" stroke="#8d6896" stroke-width="20" stroke-linecap="round"/>
<path d="M-10 330 C50 330 44 270 82 260 C108 254 114 282 96 286" fill="none" stroke="#6b4a72" stroke-width="16" stroke-linecap="round"/>
{grass(450, 80, 28, "#1f3318", 6)}
{peek(478, 398, 1.1, -5)}
{rab()}
{grass(500, 55, 24, "#4d6b2c", 7)}
{peek(60, 470, 1.5, 4)}
{pumpkin(448, 474, 1.05, glow="#c6ff7a")}
{grass(532, 40, 20, "#a8c66c", 8)}''')

for name, svg in [("A-moonlit-meadow", A), ("B-pumpkin-dusk", B), ("C-cozy-eldritch", C)]:
    open(f"{OUT}/{name}.svg", "w").write(svg)
