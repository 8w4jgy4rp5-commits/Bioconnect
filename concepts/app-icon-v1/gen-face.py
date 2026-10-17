# Face-up icon: the in-game head and ears (rabbit-face.png, built by face-rig.html) over background A.
import importlib.util, os
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("g", os.path.join(here, "gen.py")); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

def face(x=96, y=40, w=352):
    return f'<image href="rabbit-face.png" x="{x}" y="{y}" width="{w}" height="{round(w*677/552)}"/>'

SKY = '<linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241a3e"/><stop offset="1" stop-color="#55407a"/></linearGradient>'
def moon_grad(c):
    return (f'<radialGradient id="moon"><stop offset=".72" stop-color="{c}"/><stop offset=".78" stop-color="{c}" stop-opacity=".35"/>'
            f'<stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>')
STARS = '<circle cx="470" cy="70" r="3" fill="#fff8"/><circle cx="440" cy="200" r="2.5" fill="#fff6"/><circle cx="40" cy="330" r="2.5" fill="#fff6"/>'

def icon(moon, color):
    return g.wrap(SKY + moon_grad(color), f'''<rect width="512" height="512" fill="url(#skyA)"/>
{moon}{STARS}{g.bat(455,130,1.0)}
{g.grass(470, 50, 30, "#2e5a2c", 1)}
{face()}
{g.grass(505, 40, 26, "#3f7a35", 2)}
{g.pumpkin(64, 466, 1.15)}
{g.grass(530, 30, 22, "#56963f", 3)}''')

V = {
  "A1-face-moon-behind": icon('<circle cx="270" cy="270" r="235" fill="url(#moon)"/>', "#fbe9a6"),
  "A2-face-moon-corner": icon('<circle cx="118" cy="128" r="135" fill="url(#moon)"/>', "#fbe9a6"),
  "A3-face-harvest-moon": icon('<circle cx="270" cy="270" r="235" fill="url(#moon)"/>', "#f0a04b"),
}
for n, s in V.items():
    open(os.path.join(here, n + ".svg"), "w").write(s)
