C, P, L, N, PAN = "#2bd2ff", "#ff3cac", "#c6ff3d", "#120e26", "#1f1940"
FONT = "/home/user/picktwo/node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-700-normal.woff2"
INTER = "/home/user/picktwo/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"

def glow(i): return f'<defs><filter id="g{i}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'

def svg(body, i, size, glowon=True):
    f = f' filter="url(#g{i}-{size})"' if glowon else ""
    return f'<svg width="{size}" height="{size}" viewBox="0 0 48 48" fill="none">{glow(f"{i}-{size}")}<g{f}>{body}</g></svg>'

def almond(cx, cy, w, h): return f"M{cx-w} {cy} Q{cx} {cy-h} {cx+w} {cy} Q{cx} {cy+h} {cx-w} {cy}Z"

MARKS = [
 ("eyes", "A · Eyes, refreshed", "The current mark, rebuilt for Arcade Night: thicker rings, cyan A and pink B, both pupils glancing at the pick, lime crowd dots above.",
  f'<circle cx="14" cy="29" r="9.5" stroke="{C}" stroke-width="3.4"/><circle cx="34" cy="29" r="9.5" stroke="{P}" stroke-width="3.4"/>'
  f'<circle cx="17.5" cy="27" r="3.6" fill="{C}"/><circle cx="37.5" cy="27" r="3.6" fill="{P}"/>'
  f'<circle cx="29" cy="10" r="2.3" fill="{L}"/><circle cx="34" cy="7.5" r="2.3" fill="{L}"/><circle cx="39" cy="10" r="2.3" fill="{L}"/>'),
 ("sideeye", "B · Side-eye", "Two almond eyes sizing each other up, like you deciding between two options. A little cheeky, still clean.",
  f'<path d="{almond(12.5,27,9,11)}" stroke="{C}" stroke-width="3.2" stroke-linejoin="round"/><path d="{almond(35.5,27,9,11)}" stroke="{P}" stroke-width="3.2" stroke-linejoin="round"/>'
  f'<circle cx="16" cy="27" r="3.6" fill="{C}"/><circle cx="32" cy="27" r="3.6" fill="{P}"/>'
  f'<path d="M24 9v6M19.5 11l2 3.5M28.5 11l-2 3.5" stroke="{L}" stroke-width="2.6" stroke-linecap="round"/>'),
 ("wink", "C · Wink pick", "One eye open on A, one wink on B, plus a lime spark. Says \"good choice\" and has the most personality.",
  f'<circle cx="14" cy="28" r="9.5" stroke="{C}" stroke-width="3.4"/><circle cx="16.5" cy="27" r="3.6" fill="{C}"/>'
  f'<path d="M25.5 29 Q34 21 42.5 29" stroke="{P}" stroke-width="3.6" stroke-linecap="round"/>'
  f'<path d="M38 8 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="{L}"/>'),
 ("cards", "D · Swipe cards", "Two tilted cards, the front one checked. Ties straight to throwing a photo off the card to pick it.",
  f'<rect x="7" y="11" width="20" height="27" rx="4.5" stroke="{C}" stroke-width="3.2" transform="rotate(-12 17 24.5)"/>'
  f'<rect x="20" y="10" width="20" height="27" rx="4.5" fill="{N}" stroke="{P}" stroke-width="3.2" transform="rotate(9 30 23.5)"/>'
  f'<path d="M25.5 24.5l3.6 3.6 6.4-7" stroke="{L}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'),
 ("bolt", "E · Bolt versus", "A circle split into cyan A and pink B by a lime bolt. Reads as \"this vs that\" and nods to the ⚡ points.",
  f'<path d="M24 5 A19 19 0 0 0 24 43 L21 27 H27 L22 5Z" fill="{C}" opacity=".95"/><path d="M27 5 A19 19 0 0 1 25 43 L30 21 H24 L27 5Z" fill="{P}" opacity=".95"/>'
  f'<path d="M27.5 3 L19.5 26 H26 L21 45 L33 20 H26.5 L31 3Z" fill="{L}"/>'),
 ("cp", "F · cp monogram", "Just the letters: a cyan c and a pink p, with a lime dot as the pick. Simple and grown-up, easiest to read tiny.",
  f'<text x="4" y="36" font-family="CP" font-size="31" fill="{C}">c</text><text x="22" y="36" font-family="CP" font-size="31" fill="{P}">p</text>'
  f'<circle cx="38.5" cy="11" r="3.4" fill="{L}"/>'),
]

def tile(i, m):
    mid, name, why, body = m
    big = svg(body, i, 150)
    icon = svg(body, i, 70)
    sm = svg(body, i, 28)
    smlight = svg(body.replace(f'fill="{N}"', 'fill="#ffffff"'), i, 26, glowon=False)
    return f'''<div class="tile">
  <div class="hero">{big}</div>
  <div class="row">
    <div class="icon">{icon}</div>
    <div class="lock dark">{sm}<span>crowdpick<b>.ai</b></span></div>
  </div>
  <div class="lock light">{smlight}<span>crowdpick<b>.ai</b></span></div>
  <h3>{name}</h3><p>{why}</p>
</div>'''

def page(title, sub, ms, off):
    return f'<section class="page"><h1>{title}</h1><p class="sub">{sub}</p><div class="grid">' + "".join(tile(off+k, m) for k, m in enumerate(ms)) + '</div></section>'

html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: CP; src: url(file://{FONT}); }}
@font-face {{ font-family: In; src: url(file://{INTER}); font-weight: 100 900; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ background: {N}; font-family: In, sans-serif; color: #eae6ff; }}
.page {{ width: 1123px; height: 794px; padding: 36px 44px; background: radial-gradient(120% 70% at 50% 0%, #2a1d5c, {N} 62%); overflow: hidden; }}
h1 {{ font-family: CP; font-size: 34px; color: {L}; text-shadow: 0 0 18px rgba(198,255,61,.35); }}
.sub {{ color: #a29ac9; font-size: 14px; margin-top: 4px; }}
.grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 22px; }}
.tile {{ background: {PAN}; border-radius: 20px; padding: 18px; box-shadow: 0 0 0 1px #3a3170, 0 0 40px rgba(255,60,172,.12); }}
.hero {{ height: 200px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: radial-gradient(circle at 50% 45%, #2a2260, {N} 75%); }}
.row {{ display: flex; gap: 12px; align-items: center; margin-top: 14px; }}
.icon {{ width: 70px; height: 70px; border-radius: 17px; background: {N}; box-shadow: 0 0 0 1px #3a3170; overflow: hidden; flex: none; }}
.lock {{ display: flex; align-items: center; gap: 7px; border-radius: 12px; padding: 10px 12px; flex: 1; }}
.lock span {{ font-family: CP; font-size: 19px; letter-spacing: -.01em; }}
.lock b {{ color: {C}; font-weight: inherit; }}
.dark {{ background: {N}; color: #fff; }}
.light {{ background: #faf8f5; color: #120e26; margin-top: 10px; }}
.light b {{ color: #0a8fb8; }}
h3 {{ font-family: CP; font-size: 19px; margin-top: 14px; color: #fff; }}
p {{ font-size: 12.5px; line-height: 1.45; color: #bdb6e0; margin-top: 4px; }}
</style></head><body>
{page("Eyes, refreshed", "Three takes on the current two-eyes mark, recoloured for Arcade Night (cyan A, pink B, lime ⚡). Each shown big, as the app icon, in the dark header, and on white (emails, share cards).", MARKS[:3], 0)}
{page("New marks", "Three fresh directions in the same colours, if you'd rather move on from the eyes.", MARKS[3:], 3)}
</body></html>'''
open("logos.html", "w").write(html)
