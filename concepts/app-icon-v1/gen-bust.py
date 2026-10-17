# Bust icon: the whole in-game rabbit (rabbit-game.png) scaled up and entering from the bottom-left,
# so the edge of the icon cuts it at the shoulders. Background A fills the rest.
import importlib.util, os, sys
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("g", os.path.join(here, "gen.py")); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

X, Y, W = (float(v) for v in (sys.argv[1:4] if len(sys.argv) > 3 else (-150, 30, 700)))
def rabbit():
    return f'<image href="rabbit-game.png" x="{X}" y="{Y}" width="{W}" height="{round(W*982/748)}"/>'

SKY = '<linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241a3e"/><stop offset="1" stop-color="#55407a"/></linearGradient>'
def moon_grad(c):
    return (f'<radialGradient id="moon"><stop offset=".72" stop-color="{c}"/><stop offset=".78" stop-color="{c}" stop-opacity=".35"/>'
            f'<stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>')
STARS = '<circle cx="470" cy="60" r="3" fill="#fff8"/><circle cx="40" cy="60" r="2.5" fill="#fff6"/><circle cx="490" cy="250" r="2.5" fill="#fff6"/>'

def icon(moon, color):
    return g.wrap(SKY + moon_grad(color), f'''<rect width="512" height="512" fill="url(#skyA)"/>
{moon}{STARS}{g.bat(70,120,1.1)}
{g.grass(470, 60, 30, "#2e5a2c", 1)}
{rabbit()}
{g.grass(520, 40, 26, "#3f7a35", 2)}
{g.pumpkin(468, 480, 0.95)}
{g.grass(535, 30, 22, "#56963f", 3)}''')

V = {
  "B1-bust-moon-right": icon('<circle cx="400" cy="150" r="140" fill="url(#moon)"/>', "#fbe9a6"),
  "B2-bust-harvest-moon": icon('<circle cx="400" cy="150" r="140" fill="url(#moon)"/>', "#f0a04b"),
}
for n, s in V.items():
    open(os.path.join(here, n + ".svg"), "w").write(s)
