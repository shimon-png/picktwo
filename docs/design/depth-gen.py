#!/usr/bin/env python3
"""Generate the crowdpick.ai redesign concepts deck as HTML (rendered to PDF with Playwright)."""
import pathlib

OUT = pathlib.Path(__file__).parent / "depth.html"

# ---------- icons ----------
I_VOTE = '<svg viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>'
I_POST = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>'
I_YOU = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'


def tabbar(active):
    def t(name, icon):
        return f'<div class="tab{" on" if name == active else ""}">{icon}<span>{name}</span></div>'
    return f'<div class="tabbar">{t("Vote", I_VOTE)}{t("Post", I_POST)}{t("You", I_YOU)}</div>'


def header():
    return ('<div class="hdr"><span class="logo"><i class="mark"><b></b><b></b></i>crowdpick<em>.ai</em></span>'
            '<span class="pp">⚡ 128</span></div>')


def opt(side, emoji, label, pct=None, picked=False):
    p = f'<div class="pct">{pct}%</div>' if pct is not None else ""
    chk = '<div class="chk">✓</div>' if picked else ""
    cls = f"opt {side.lower()}" + (" picked" if picked else "") + (" res" if pct is not None else "")
    return (f'<div class="{cls}"><div class="img"><span>{emoji}</span>{p}{chk}</div>'
            f'<div class="lbl"><b class="tag">{side}</b>{label}</div></div>')


def vote_screen():
    return f'''<div class="scr">{header()}
<div class="goal"><span>🔥 4-day streak</span><span>7 / 10 today</span></div><div class="prog"><i style="width:70%"></i></div>
<div class="deck"><div class="peek"></div><div class="card">
<div class="meta"><span class="av">M</span>@maya · Parent of 3–4<span class="r">2h left</span></div>
<div class="q">Which one for the beach trip?</div>
<div class="opts">{opt("A", "🕶️", "Retro shades")}<div class="vs">VS</div>{opt("B", "👒", "Bucket hat")}</div>
<div class="hint"><span>← swipe A</span><span class="skip">Skip</span><span>B swipe →</span></div>
</div></div>{tabbar("Vote")}</div>'''


def result_screen():
    return f'''<div class="scr result">{header()}
<div class="deck"><div class="card">
<div class="meta"><span class="av">M</span>@maya · 214 votes<span class="r">2h left</span></div>
<div class="q">Which one for the beach trip?</div>
<div class="opts">{opt("A", "🕶️", "Retro shades", 64, True)}<div class="vs">VS</div>{opt("B", "👒", "Bucket hat", 36)}</div>
<div class="win">You’re with the crowd! <b>+3 ⚡</b></div>
<div class="whyq">Why? <em>+1 ⚡</em></div>
<div class="chips"><span class="chip on">Looks better</span><span class="chip">More practical</span><span class="chip">Just feels right</span></div>
<div class="btn">Next battle →</div>
</div></div>{tabbar("Vote")}</div>'''


def post_screen():
    return f'''<div class="scr post"><div class="phdr"><span class="x">✕</span><span>New battle</span><span class="dots"><i class="on"></i><i class="on"></i><i></i></span></div>
<div class="lab">Your question</div>
<div class="field">Which lunchbox for school?<i class="caret"></i></div>
<div class="lab">Two options</div>
<div class="slots"><div class="slot a"><span>🍱</span><div class="lbl"><b class="tag">A</b>Bento box</div></div><div class="slot b"><span>🥪</span><div class="lbl"><b class="tag">B</b>Classic tin</div></div></div>
<div class="lab">Closes in</div>
<div class="seg"><span>1h</span><span class="on">24h</span><span>3d</span></div>
<div class="boost"><span>⚡ Boost to the top</span><span class="sw"><i></i></span></div>
<div class="btn">Post battle</div></div>'''


def you_screen():
    return f'''<div class="scr">{header()}
<div class="prof"><div class="bigav">A</div><div><div class="name">Alex</div><div class="handle">@alex · 02134</div></div></div>
<div class="tier"><span>⚡ 128 · <b>High priority</b></span><span class="tbar"><i style="width:62%"></i></span><span class="tnext">72 ⚡ to Top</span></div>
<div class="stats"><div><b>342</b><span>Votes</span></div><div><b>12</b><span>Battles</span></div><div><b>71%</b><span>Crowd match</span></div></div>
<div class="lab">Your battles</div>
<div class="row"><div class="rq">Bike: red or teal?</div><div class="bar2"><i class="ba" style="width:58%">58</i><i class="bb">42</i></div></div>
<div class="row"><div class="rq">Rain boots: yellow or navy?</div><div class="bar2"><i class="ba" style="width:31%">31</i><i class="bb">69</i></div></div>
<div class="badges"><span>🏅 Trendsetter</span><span>🎯 Sharp eye</span></div>
{tabbar("You")}</div>'''


SCREENS = [("Vote", vote_screen), ("Result", result_screen), ("Post", post_screen), ("You", you_screen)]

# ---------- concepts ----------
CONCEPTS = [
    dict(
        id="base", name="Base design (today)", tag="The current crowdpick.ai look, saved as the revert point.",
        fonts="Inter:wght@400;500;600",
        type_name="Inter 500", type_sample="Which one for the beach trip?",
        palette=[("Blue A", "#2f6bff"), ("Coral B", "#f0525a"), ("Amber ⚡", "#f5a524"), ("Surface", "#f4f5f9"), ("Ink", "#1b2033")],
        why=["Clean, calm and trustworthy, but very quiet: lots of white and grey.",
             "Kept exactly as-is at main @ 22fb559 (see docs/design/base-design.md).",
             "Use this page as the yardstick for the six concepts that follow."],
        energy=1,
    ),
    dict(
        id="pop", name="1 · Pop Fizz", tag="Bright, bubbly and loud. Hot pink vs electric blue on clean white.",
        fonts="Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800",
        type_name="Bricolage Grotesque 800 / 500", type_sample="Which one for the beach trip?",
        palette=[("Electric A", "#2e5bff"), ("Hot pink B", "#ff2e93"), ("Lemon ⚡", "#ffd400"), ("Blush", "#fff1f7"), ("Ink", "#16113a")],
        why=["Keeps today’s white canvas so it feels familiar, but every interactive thing is saturated.",
             "A gradient VS badge and big rounded cards make each battle feel like a mini event.",
             "Lowest-risk upgrade: mostly a token + font swap, buildable in a day."],
        energy=3,
    ),
    dict(
        id="arcade", name="2 · Arcade Night", tag="Dark mode game show. Neon glow, XP bar, combo streaks.",
        fonts="Chakra+Petch:wght@500;600;700&family=Inter:wght@400;500;600",
        type_name="Chakra Petch 700 + Inter", type_sample="Which one for the beach trip?",
        palette=[("Cyan A", "#2bd2ff"), ("Neon pink B", "#ff3cac"), ("Lime ⚡", "#c6ff3d"), ("Night", "#120e26"), ("Panel", "#1f1940")],
        why=["Matches the dark theme in the Swipe PRD v0.2 and makes voting feel like scoring points.",
             "Glow on the picked side and a lime ⚡ meter turn the streak into something to chase.",
             "Best for evening phone use and a younger, more playful crowd."],
        energy=5,
    ),
    dict(
        id="candy", name="3 · Sticker Club", tag="Warm, chunky and friendly. Feels like a scrapbook of picks.",
        fonts="Fredoka:wght@500;600;700&family=Nunito:wght@500;700",
        type_name="Fredoka 600 + Nunito", type_sample="Which one for the beach trip?",
        palette=[("Grape A", "#7b5cff"), ("Tangerine B", "#ff7a1a"), ("Sunflower ⚡", "#ffc531"), ("Cream", "#fff6e9"), ("Cocoa", "#3a2a1f")],
        why=["Soft cream background and rounded type feel warm and parent-friendly.",
             "Chunky drop shadows and tilted sticker badges add fun without being noisy.",
             "Great fit if parents are the core audience; badges give us a reward system later."],
        energy=3,
    ),
    dict(
        id="brutal", name="4 · Bold Block", tag="Neo-brutalist. Thick outlines, flat primaries, hard shadows.",
        fonts="Archivo+Black&family=Space+Grotesk:wght@500;700",
        type_name="Archivo Black + Space Grotesk", type_sample="Which one for the beach trip?",
        palette=[("Royal A", "#3d5afe"), ("Tomato B", "#ff4b3e"), ("Yellow ⚡", "#ffe600"), ("Paper", "#fffdf5"), ("Black", "#111111")],
        why=["Instantly recognisable and very current (think Gumroad, Figma community).",
             "Buttons look pressable, with hard offset shadows that snap on tap.",
             "High contrast is great for accessibility and for screenshots shared on social."],
        energy=4,
    ),
    dict(
        id="aurora", name="5 · Aurora Glass", tag="Dreamy gradients and frosted cards. Premium and modern.",
        fonts="Plus+Jakarta+Sans:wght@500;600;700;800",
        type_name="Plus Jakarta Sans 700 / 500", type_sample="Which one for the beach trip?",
        palette=[("Teal A", "#14b8a6"), ("Violet B", "#8b5cf6"), ("Peach ⚡", "#ff9f6e"), ("Mist", "#eef1ff"), ("Deep", "#1e1b3a")],
        why=["A moving mesh gradient behind frosted-glass cards feels premium and calm-exciting.",
             "Colour comes from the background, so product photos stay the hero.",
             "Pairs well with a future premium tier or brand battles."],
        energy=3,
    ),
    dict(
        id="versus", name="6 · Versus Sport", tag="Scoreboard energy. Split-screen red vs blue, condensed headlines.",
        fonts="Anton&family=Inter:wght@400;500;700",
        type_name="Anton + Inter 700", type_sample="WHICH ONE FOR THE BEACH TRIP?",
        palette=[("Red A", "#ff3b30"), ("Blue B", "#0a84ff"), ("Volt ⚡", "#e8ff00"), ("Court", "#f2f2f2"), ("Pitch black", "#0b0b0f")],
        why=["Every battle is a face-off: a diagonal split and a big VS make it feel like game day.",
             "Results read like a final score, which makes them fun to share.",
             "Most dramatic change. Strongest personality, but the furthest from today."],
        energy=5,
    ),
]


SOFT = dict(
    id="soft", name="A · Pop Soft", tag="Pop Fizz, calmed down. Warm blush background, violet vs pink, one gradient moment.",
    fonts="Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Inter:wght@400;500;600",
    type_name="Bricolage Grotesque 700 + Inter", type_sample="Which one for the beach trip?",
    palette=[("Violet A", "#6c4cff"), ("Pink B", "#ff3d8b"), ("Sun ⚡", "#ffc93c"), ("Blush", "#fff6f4"), ("Plum ink", "#24182f")],
    why=["Keeps Pop Fizz’s friendly type and pink, but drops the tilted cards, stickers and busy gradients.",
         "Warm blush and violet read stylish and feminine without being girly; think Glossier, Bumble, Pinterest.",
         "The violet-to-pink gradient appears only on the main button and the pick, so it still feels exciting."],
    energy=3,
)
CLEAN = dict(
    id="clean", name="B · Pop Clean", tag="The simplest version. White, solid colour, crisp type. Photos do the talking.",
    fonts="DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700",
    type_name="DM Sans 700 / 500", type_sample="Which one for the beach trip?",
    palette=[("Cobalt A", "#3355ff"), ("Rose B", "#ff4f86"), ("Lemon ⚡", "#ffd23f"), ("Cloud", "#f6f6f8"), ("Ink", "#151521")],
    why=["Closest to today’s structure, so it is the quickest to build and the least risky.",
         "Pop Fizz’s blue and pink, softened to cobalt and rose, on a clean white page. No gradients at all.",
         "Feels like a modern consumer app (Instagram, BeReal): confident, simple, and lets the photos stand out."],
    energy=2,
)
SOFT["name"]="★ Pop Soft (your pick)"
HONEY = dict(
    id="honey", name="1 · Honey", tag="Inspired by Bumble. Sunny yellow, warm white, chunky rounded type and pill buttons.",
    fonts="Figtree:wght@500;600;700;800",
    type_name="Figtree 800 / 500", type_sample="Which one for the beach trip?",
    palette=[("Honey A", "#ffc629"), ("Coral B", "#ff6f59"), ("Honey ⚡", "#ffc629"), ("Warm white", "#fffdf6"), ("Charcoal", "#1f1f1d")],
    why=["Yellow is optimistic and instantly ownable. It says ‘fun, safe, friendly’ to a young, female-skewing crowd.",
         "Big pill buttons in yellow with charcoal text, soft cards, and lots of white keep it simple.",
         "The yellow carries the energy, so everything else can stay quiet."],
    energy=3,
)
MEMBERS = dict(
    id="members", name="2 · Members", tag="Inspired by The League. Deep navy, crisp white, gold details. Exclusive and polished.",
    fonts="Manrope:wght@400;500;600;700;800",
    type_name="Manrope 700 + tracked caps", type_sample="Which one for the beach trip?",
    palette=[("Ice A", "#8fb8ff"), ("Blush B", "#f4a7bb"), ("Gold ⚡", "#d8b45c"), ("Navy", "#0d1834"), ("Card", "#16244a")],
    why=["Feels premium and a little exclusive, like an invite-only club. Good if we lean into ‘taste’ and status.",
         "Dark navy (not black) with soft ice blue and blush keeps it elegant rather than gamer.",
         "Gold ⚡ priority points read like membership perks."],
    energy=2,
)
PROMPT = dict(
    id="prompt", name="3 · Prompt", tag="Inspired by Hinge. Editorial serif, black and white, photo-first, warm terracotta accent.",
    fonts="Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600",
    type_name="Instrument Serif + Inter", type_sample="Which one for the beach trip?",
    palette=[("Plum A", "#5b2d82"), ("Terracotta B", "#c95a3b"), ("Sand ⚡", "#e8b04a"), ("Paper", "#faf8f5"), ("Ink", "#111111")],
    why=["A magazine-style serif makes every question feel considered and grown-up, never childish.",
         "Black, white and big photos; colour only marks A and B. The calmest, most adult option.",
         "Pairs with a ‘thoughtful picks’ tone: reasons and report-backs feel like stories."],
    energy=2,
)
SWEET = dict(
    id="sweet", name="4 · Sweet Spot", tag="A blend of all three on Pop Soft’s base: blush, honey CTA, serif headlines.",
    fonts="Instrument+Serif:ital@0;1&family=Figtree:wght@500;600;700",
    type_name="Instrument Serif + Figtree", type_sample="Which one for the beach trip?",
    palette=[("Violet A", "#6c4cff"), ("Pink B", "#ff3d8b"), ("Honey ⚡", "#ffc629"), ("Blush", "#fff6f4"), ("Navy ink", "#14193a")],
    why=["Pop Soft’s colours (which you liked) plus Hinge’s elegant serif for questions.",
         "Bumble-style honey pill for the main button and ⚡, so the action is always obvious.",
         "Navy ink from The League instead of black, for a softer, more polished feel."],
    energy=3,
)
PROMPT["name"]="Live now · Prompt"
PROMPT["tag"]="Hinge-inspired editorial serif, black and white, photo-first. A is a clear blue, B a warm red."
PROMPT["palette"]=[("Blue A", "#2f5ff0"), ("Red B", "#e8384f"), ("Sand ⚡", "#f0b43c"), ("Paper", "#faf8f5"), ("Ink", "#111111")]
PROMPT["why"]=["Same calm, grown-up layout you liked: magazine serif, black and white, big photos.",
         "Plum and terracotta are swapped for a confident blue and a warm red. Vibrant, but not primary-colour loud.",
         "Red vs blue reads instantly as ‘this or that’, which makes results easy to scan and share."]
PAL=[("Blue A", "#2f5ff0"), ("Red B", "#e8384f"), ("Sand ⚡", "#f0b43c"), ("Paper", "#faf8f5"), ("Ink", "#111111")]
LIFT=dict(PROMPT, id="plift", name="Depth 1 · Lifted", tag="Same Prompt look, but everything floats: layered soft shadows, photos raised off the card, a coloured glow under your pick.",
  palette=PAL, energy=3, why=["Real elevation (two-layer shadows) gives each card and photo weight, so the page stops feeling flat.",
  "The picked photo rises and casts a blue or red glow, so the choice feels physical, like the throw.",
  "Smallest change from what is live: shadows, radii and one glow. About half a day to build."])
WASH=dict(PROMPT, id="pwash", name="Depth 2 · Colour wash", tag="Blue and red do more work: gradient tints on each side, coloured frames, a blue-to-red split behind the card.",
  palette=[("Blue A", "#2f5ff0"), ("Red B", "#e8384f"), ("Sand ⚡", "#f0b43c"), ("Blue→Red", "#8a4fb0"), ("Ink", "#111111")], energy=4, why=["Each option owns its colour: a soft blue or red gradient behind the photo and a thin coloured frame.",
  "A faint blue-to-red wash behind the deck says ‘this vs that’ before you read a word.",
  "Results bars and the main button pick up the blue-to-red gradient, so the energy carries through."])
BOLD=dict(PROMPT, id="pbold", name="Depth 3 · Ink stage", tag="A black stage for the question with big white serif type; photos sit on it like prints. Editorial and dramatic.",
  palette=[("Blue A", "#4a74ff"), ("Red B", "#ff4d63"), ("Sand ⚡", "#f0b43c"), ("Stage", "#141414"), ("Paper", "#faf8f5")], energy=4, why=["Contrast does the work: a dark card makes photos glow and the serif question reads like a magazine cover.",
  "Keeps the paper pages for You, Post and Settings, so only the moment of choosing gets the drama.",
  "Blue and red get brighter on the dark stage, which adds energy without adding clutter."])
CONCEPTS = [PROMPT, LIFT, WASH, BOLD]

# ---------- shared CSS ----------
BASE_CSS = r"""
@page { size: 1123px 794px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, system-ui, sans-serif; color: #15172a; }
.page { width: 1123px; height: 794px; position: relative; overflow: hidden; page-break-after: always; padding: 34px 40px 26px; display: flex; flex-direction: column; }
.top { display: flex; gap: 28px; align-items: flex-start; height: 168px; }
.title { width: 330px; flex: none; }
.title .kick { font: 600 11px/1 Inter, sans-serif; letter-spacing: .14em; text-transform: uppercase; opacity: .55; }
.title h2 { font-size: 30px; line-height: 1.05; margin: 8px 0 8px; letter-spacing: -.02em; }
.title p { font: 400 13px/1.45 Inter, sans-serif; opacity: .78; }
.energy { margin-top: 10px; font: 500 11px Inter, sans-serif; opacity: .7; }
.pal { flex: none; width: 300px; }
.pal .swatches { display: flex; gap: 8px; }
.pal .s { width: 52px; }
.pal .s i { display: block; height: 46px; border-radius: 10px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
.pal .s span { display: block; font: 500 9.5px/1.25 Inter, sans-serif; margin-top: 5px; opacity: .8; }
.pal .s small { font: 400 9px Inter, monospace; opacity: .55; }
.pal .typ { margin-top: 12px; }
.pal .typ .big { font-size: 22px; line-height: 1.1; }
.pal .typ .nm { font: 500 10.5px Inter, sans-serif; opacity: .6; margin-top: 3px; }
.why { flex: 1; font: 400 12.2px/1.45 Inter, sans-serif; }
.why h4, .pal h4 { font: 600 10px/1 Inter, sans-serif; letter-spacing: .12em; text-transform: uppercase; opacity: .55; margin-bottom: 8px; }
.why li { margin: 0 0 6px 14px; }
.phones { flex: 1; display: flex; justify-content: space-between; align-items: flex-end; }
.ph { width: 236px; }
.ph .cap { font: 600 10.5px Inter, sans-serif; letter-spacing: .1em; text-transform: uppercase; opacity: .55; margin: 0 0 7px 4px; }
.frame { width: 236px; height: 500px; border-radius: 34px; padding: 7px; background: #0d0e14; box-shadow: 0 20px 40px rgba(10,15,40,.22); }
.scr { width: 222px; height: 486px; border-radius: 28px; overflow: hidden; position: relative; padding: 30px 12px 0; font-size: 11px; display: flex; flex-direction: column; }
.scr::before { content: ""; position: absolute; top: 9px; left: 50%; width: 64px; height: 17px; margin-left: -32px; border-radius: 10px; background: #0d0e14; }
.hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.logo { display: flex; align-items: center; gap: 5px; font-weight: 600; font-size: 12.5px; letter-spacing: -.02em; }
.logo em { font-style: normal; opacity: .5; }
.mark { display: inline-flex; gap: 2px; }
.mark b { width: 7px; height: 13px; border-radius: 3px; display: block; }
.mark b:first-child { background: var(--a); } .mark b:last-child { background: var(--b); }
.pp { font-weight: 600; font-size: 10.5px; padding: 3px 8px; border-radius: 99px; background: var(--pps); color: var(--ppt); }
.goal { display: flex; justify-content: space-between; font-size: 9.5px; opacity: .75; margin-bottom: 4px; }
.prog { height: 5px; border-radius: 9px; background: var(--track); overflow: hidden; margin-bottom: 10px; }
.prog i { display: block; height: 100%; background: var(--pp); border-radius: 9px; }
.deck { position: relative; flex: 1; }
.peek { position: absolute; left: 10px; right: 10px; top: 8px; height: 330px; border-radius: var(--rc); background: var(--card); opacity: .5; }
.card { position: relative; background: var(--card); border-radius: var(--rc); padding: 11px; box-shadow: var(--shadow); }
.meta { display: flex; align-items: center; gap: 5px; font-size: 9.5px; opacity: .7; }
.meta .r { margin-left: auto; }
.av { width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 700; background: var(--b); color: #fff; }
.q { font-family: var(--fd); font-weight: var(--fw); font-size: 16px; line-height: 1.15; margin: 8px 0 10px; letter-spacing: var(--ls, -.01em); }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; position: relative; }
.img { height: 150px; border-radius: var(--ri); display: flex; align-items: center; justify-content: center; position: relative; font-size: 54px; overflow: hidden; }
.opt.a .img { background: var(--as); } .opt.b .img { background: var(--bs); }
.lbl { font-size: 10.5px; font-weight: 500; margin-top: 6px; display: flex; align-items: center; gap: 5px; }
.tag { display: inline-flex; width: 16px; height: 16px; align-items: center; justify-content: center; border-radius: 5px; color: #fff; font-size: 9px; }
.a .tag { background: var(--a); } .b .tag { background: var(--b); }
.vs { position: absolute; left: 50%; top: 75px; transform: translate(-50%, -50%); z-index: 2; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 800 10px var(--fd); background: var(--vsbg); color: var(--vsfg); box-shadow: 0 3px 10px rgba(0,0,0,.18); }
.hint { display: flex; justify-content: space-between; font-size: 9px; opacity: .6; margin-top: 10px; }
.hint .skip { font-weight: 600; opacity: 1; }
.res .img span { opacity: .35; }
.pct { position: absolute; inset: auto 0 0 0; font: var(--fw) 26px/1 var(--fd); padding: 8px; color: #fff; }
.opt.a.res .img::after, .opt.b.res .img::after { content: ""; position: absolute; inset: 0; }
.opt.a .pct { background: linear-gradient(transparent, var(--a)); } .opt.b .pct { background: linear-gradient(transparent, var(--b)); }
.picked .img { box-shadow: inset 0 0 0 3px var(--a); }
.chk { position: absolute; top: 7px; right: 7px; width: 20px; height: 20px; border-radius: 50%; background: var(--a); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.win { margin-top: 10px; padding: 7px 9px; border-radius: var(--rb); background: var(--pps); color: var(--ppt); font-weight: 600; font-size: 10.5px; display: flex; justify-content: space-between; }
.whyq { font-size: 9.5px; margin: 9px 0 5px; opacity: .75; }
.whyq em { font-style: normal; color: var(--ppt); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font-size: 9.5px; padding: 4px 7px; border-radius: var(--rchip); background: var(--chip); }
.chip.on { background: var(--a); color: #fff; }
.btn { margin-top: 10px; text-align: center; padding: 9px; border-radius: var(--rb); background: var(--btn); color: var(--btnfg); font-weight: 600; font-size: 11.5px; font-family: var(--fd); }
.tabbar { position: absolute; left: 0; right: 0; bottom: 0; height: 52px; display: flex; justify-content: space-around; align-items: flex-start; padding-top: 8px; background: var(--tabbg); border-top: 1px solid var(--line); }
.tab { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 8.5px; opacity: .5; }
.tab svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tab.on { opacity: 1; color: var(--tabon); font-weight: 600; }
/* post */
.phdr { display: flex; justify-content: space-between; align-items: center; font-family: var(--fd); font-weight: var(--fw); font-size: 14px; margin: 2px 0 14px; }
.phdr .x { font-size: 12px; opacity: .6; }
.dots { display: flex; gap: 3px; } .dots i { width: 14px; height: 4px; border-radius: 3px; background: var(--track); } .dots i.on { background: var(--a); }
.lab { font-size: 9.5px; font-weight: 600; opacity: .65; margin: 10px 0 5px; text-transform: var(--labtt, none); letter-spacing: var(--labls, 0); }
.field { padding: 10px; border-radius: var(--rb); background: var(--card); box-shadow: var(--fieldshadow); font-size: 12px; font-family: var(--fd); font-weight: var(--fw2, 500); }
.caret { display: inline-block; width: 1.5px; height: 12px; background: var(--a); vertical-align: -2px; margin-left: 1px; }
.slots { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.slot { border-radius: var(--ri); padding: 8px; background: var(--card); box-shadow: var(--shadow); }
.slot > span { display: flex; height: 92px; align-items: center; justify-content: center; font-size: 40px; border-radius: calc(var(--ri) - 3px); }
.slot.a > span { background: var(--as); } .slot.b > span { background: var(--bs); }
.slot .lbl { font-size: 9.5px; }
.seg { display: flex; background: var(--chip); border-radius: var(--rb); padding: 3px; }
.seg span { flex: 1; text-align: center; padding: 5px; border-radius: calc(var(--rb) - 2px); font-size: 10px; }
.seg .on { background: var(--card); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.boost { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; padding: 9px 10px; border-radius: var(--rb); background: var(--pps); color: var(--ppt); font-weight: 600; font-size: 10.5px; }
.sw { width: 28px; height: 16px; border-radius: 9px; background: var(--pp); position: relative; } .sw i { position: absolute; right: 2px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
.post .btn { position: absolute; left: 12px; right: 12px; bottom: 18px; padding: 11px; }
/* you */
.prof { display: flex; gap: 10px; align-items: center; margin: 6px 0 10px; }
.bigav { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: var(--fw) 20px var(--fd); color: #fff; background: linear-gradient(135deg, var(--a), var(--b)); }
.name { font: var(--fw) 17px/1.1 var(--fd); }
.handle { font-size: 9.5px; opacity: .6; margin-top: 2px; }
.tier { padding: 9px 10px; border-radius: var(--rc); background: var(--pps); color: var(--ppt); font-size: 10.5px; display: flex; flex-direction: column; gap: 5px; }
.tbar { height: 6px; border-radius: 6px; background: rgba(0,0,0,.1); overflow: hidden; } .tbar i { display: block; height: 100%; background: var(--pp); }
.tnext { font-size: 9px; opacity: .75; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 9px 0 2px; }
.stats div { background: var(--card); box-shadow: var(--shadow); border-radius: var(--rb); padding: 7px 4px; text-align: center; }
.stats b { display: block; font: var(--fw) 15px var(--fd); } .stats span { font-size: 8.5px; opacity: .65; }
.row { background: var(--card); box-shadow: var(--shadow); border-radius: var(--rb); padding: 7px 8px; margin-bottom: 6px; }
.rq { font-size: 10px; font-weight: 500; margin-bottom: 5px; }
.bar2 { display: flex; height: 14px; border-radius: 5px; overflow: hidden; font-size: 8.5px; color: #fff; font-weight: 700; font-style: normal; }
.bar2 i { font-style: normal; display: flex; align-items: center; padding: 0 5px; }
.bar2 .ba { background: var(--a); } .bar2 .bb { background: var(--b); flex: 1; justify-content: flex-end; }
.badges { display: flex; gap: 5px; margin-top: 4px; } .badges span { font-size: 9px; padding: 4px 7px; border-radius: var(--rchip); background: var(--chip); }
.result .img { height: 104px; font-size: 42px; }
.result .vs { top: 52px; }
.result .q { margin: 6px 0 8px; }
.foot { position: absolute; bottom: 12px; right: 40px; font: 400 9.5px Inter, sans-serif; opacity: .45; }
"""

THEME_CSS = {
    "plift": r"""
.c-plift { --a:#2f5ff0; --b:#e8384f; --as:#e8eefd; --bs:#fde9ec; --pp:#f0b43c; --pps:#fdf3dc; --ppt:#6e4a00;
 --card:#fff; --track:#ece8e2; --rc:10px; --ri:8px; --rb:99px; --rchip:99px; --shadow:0 0 0 1px #ece8e2; --chip:#f3f0eb; --btn:#111; --btnfg:#fff;
 --vsbg:#fff; --vsfg:#111; --tabbg:#fff; --tabon:#111; --line:#ece8e2; --fd:'Instrument Serif'; --fw:400; --fw2:400; --ls:0; --fieldshadow:0 1px 0 #111; }
.c-plift.page { background:#faf8f5; color:#111; }
.c-plift .scr { background:#faf8f5; color:#111; }
.c-plift .title h2, .c-plift .typ .big { font-family:'Instrument Serif'; font-weight:400; font-size:36px; }
.c-plift .typ .big { font-size:26px; }
.c-plift .q { font-size:21px; line-height:1.05; }
.c-plift .vs { font:italic 400 13px 'Instrument Serif'; box-shadow:0 0 0 1px #ddd; }
.c-plift .pct { font:400 30px 'Instrument Serif'; }
.c-plift .name, .c-plift .phdr, .c-plift .stats b { font-family:'Instrument Serif'; font-weight:400; }
.c-plift .name { font-size:22px; } .c-plift .stats b { font-size:20px; } .c-plift .phdr { font-size:19px; }
.c-plift .field { border-radius:0; background:transparent; font-size:16px; padding:8px 0; }
.c-plift .btn { font-family:Inter; font-weight:600; }
.c-plift .chip.on { background:#111; }
.c-plift .card { box-shadow:none; background:transparent; padding:6px 0 0; }
.c-plift .peek { display:none; }
.c-plift .picked .img { box-shadow: inset 0 0 0 2px #111; }
.c-plift .chk { background:#111; }
.c-plift .bigav { background:linear-gradient(135deg,#2f5ff0,#e8384f); }
.c-plift .stats div, .c-plift .row { box-shadow:0 0 0 1px #ece8e2; border-radius:10px; }
.c-plift .tier { border-radius:10px; }

.c-plift .card { background:#fff; padding:11px; border-radius:18px; box-shadow:0 1px 2px rgba(30,20,10,.06), 0 12px 32px rgba(30,20,10,.12); }
.c-plift .img { border-radius:14px; box-shadow:0 2px 4px rgba(0,0,0,.08), 0 10px 22px rgba(0,0,0,.14); }
.c-plift .picked .img { transform:translateY(-6px) scale(1.03); box-shadow: inset 0 0 0 2px #2f5ff0, 0 18px 34px rgba(47,95,240,.38); }
.c-plift .vs { box-shadow:0 6px 16px rgba(0,0,0,.18); }
.c-plift .btn { box-shadow:0 8px 18px rgba(0,0,0,.25); }
.c-plift .stats div, .c-plift .row, .c-plift .slot, .c-plift .tier { box-shadow:0 1px 2px rgba(30,20,10,.05), 0 8px 20px rgba(30,20,10,.08); border-radius:14px; }
.c-plift .peek { display:block; background:#fff; opacity:.7; box-shadow:0 8px 24px rgba(30,20,10,.1); }
.c-plift .chip { box-shadow:0 1px 3px rgba(0,0,0,.08); background:#fff; }
.c-plift .field { background:#fff; border-radius:12px; padding:10px; box-shadow:0 1px 2px rgba(0,0,0,.05), 0 6px 14px rgba(0,0,0,.06); }
""",
    "pwash": r"""
.c-pwash { --a:#2f5ff0; --b:#e8384f; --as:#e8eefd; --bs:#fde9ec; --pp:#f0b43c; --pps:#fdf3dc; --ppt:#6e4a00;
 --card:#fff; --track:#ece8e2; --rc:10px; --ri:8px; --rb:99px; --rchip:99px; --shadow:0 0 0 1px #ece8e2; --chip:#f3f0eb; --btn:#111; --btnfg:#fff;
 --vsbg:#fff; --vsfg:#111; --tabbg:#fff; --tabon:#111; --line:#ece8e2; --fd:'Instrument Serif'; --fw:400; --fw2:400; --ls:0; --fieldshadow:0 1px 0 #111; }
.c-pwash.page { background:#faf8f5; color:#111; }
.c-pwash .scr { background:#faf8f5; color:#111; }
.c-pwash .title h2, .c-pwash .typ .big { font-family:'Instrument Serif'; font-weight:400; font-size:36px; }
.c-pwash .typ .big { font-size:26px; }
.c-pwash .q { font-size:21px; line-height:1.05; }
.c-pwash .vs { font:italic 400 13px 'Instrument Serif'; box-shadow:0 0 0 1px #ddd; }
.c-pwash .pct { font:400 30px 'Instrument Serif'; }
.c-pwash .name, .c-pwash .phdr, .c-pwash .stats b { font-family:'Instrument Serif'; font-weight:400; }
.c-pwash .name { font-size:22px; } .c-pwash .stats b { font-size:20px; } .c-pwash .phdr { font-size:19px; }
.c-pwash .field { border-radius:0; background:transparent; font-size:16px; padding:8px 0; }
.c-pwash .btn { font-family:Inter; font-weight:600; }
.c-pwash .chip.on { background:#111; }
.c-pwash .card { box-shadow:none; background:transparent; padding:6px 0 0; }
.c-pwash .peek { display:none; }
.c-pwash .picked .img { box-shadow: inset 0 0 0 2px #111; }
.c-pwash .chk { background:#111; }
.c-pwash .bigav { background:linear-gradient(135deg,#2f5ff0,#e8384f); }
.c-pwash .stats div, .c-pwash .row { box-shadow:0 0 0 1px #ece8e2; border-radius:10px; }
.c-pwash .tier { border-radius:10px; }

.c-pwash { --as:linear-gradient(165deg,#dfe7ff,#b9cbff); --bs:linear-gradient(165deg,#ffe0e5,#ffb3be); --btn:linear-gradient(90deg,#2f5ff0,#e8384f); }
.c-pwash .scr { background: radial-gradient(70% 40% at 0% 35%, rgba(47,95,240,.16), transparent 70%), radial-gradient(70% 40% at 100% 45%, rgba(232,56,79,.16), transparent 70%), #faf8f5; }
.c-pwash .card { background:rgba(255,255,255,.75); padding:10px; border-radius:16px; box-shadow:0 10px 26px rgba(40,30,60,.1); }
.c-pwash .opt.a .img { box-shadow: inset 0 0 0 2px rgba(47,95,240,.55); }
.c-pwash .opt.b .img { box-shadow: inset 0 0 0 2px rgba(232,56,79,.55); }
.c-pwash .picked .img { box-shadow: inset 0 0 0 3px #2f5ff0, 0 0 0 4px rgba(47,95,240,.18); }
.c-pwash .vs { background:linear-gradient(135deg,#2f5ff0,#e8384f); color:#fff; box-shadow:none; }
.c-pwash .chip.on { background:linear-gradient(90deg,#2f5ff0,#e8384f); }
.c-pwash .prog i, .c-pwash .tbar i { background:linear-gradient(90deg,#2f5ff0,#e8384f); }
.c-pwash .bigav { background:linear-gradient(135deg,#2f5ff0,#e8384f); }
.c-pwash .slot.a { box-shadow: inset 0 0 0 1.5px rgba(47,95,240,.45); } .c-pwash .slot.b { box-shadow: inset 0 0 0 1.5px rgba(232,56,79,.45); }
.c-pwash .tab.on { color:#e8384f; }
""",
    "pbold": r"""
.c-pbold { --a:#2f5ff0; --b:#e8384f; --as:#e8eefd; --bs:#fde9ec; --pp:#f0b43c; --pps:#fdf3dc; --ppt:#6e4a00;
 --card:#fff; --track:#ece8e2; --rc:10px; --ri:8px; --rb:99px; --rchip:99px; --shadow:0 0 0 1px #ece8e2; --chip:#f3f0eb; --btn:#111; --btnfg:#fff;
 --vsbg:#fff; --vsfg:#111; --tabbg:#fff; --tabon:#111; --line:#ece8e2; --fd:'Instrument Serif'; --fw:400; --fw2:400; --ls:0; --fieldshadow:0 1px 0 #111; }
.c-pbold.page { background:#faf8f5; color:#111; }
.c-pbold .scr { background:#faf8f5; color:#111; }
.c-pbold .title h2, .c-pbold .typ .big { font-family:'Instrument Serif'; font-weight:400; font-size:36px; }
.c-pbold .typ .big { font-size:26px; }
.c-pbold .q { font-size:21px; line-height:1.05; }
.c-pbold .vs { font:italic 400 13px 'Instrument Serif'; box-shadow:0 0 0 1px #ddd; }
.c-pbold .pct { font:400 30px 'Instrument Serif'; }
.c-pbold .name, .c-pbold .phdr, .c-pbold .stats b { font-family:'Instrument Serif'; font-weight:400; }
.c-pbold .name { font-size:22px; } .c-pbold .stats b { font-size:20px; } .c-pbold .phdr { font-size:19px; }
.c-pbold .field { border-radius:0; background:transparent; font-size:16px; padding:8px 0; }
.c-pbold .btn { font-family:Inter; font-weight:600; }
.c-pbold .chip.on { background:#111; }
.c-pbold .card { box-shadow:none; background:transparent; padding:6px 0 0; }
.c-pbold .peek { display:none; }
.c-pbold .picked .img { box-shadow: inset 0 0 0 2px #111; }
.c-pbold .chk { background:#111; }
.c-pbold .bigav { background:linear-gradient(135deg,#2f5ff0,#e8384f); }
.c-pbold .stats div, .c-pbold .row { box-shadow:0 0 0 1px #ece8e2; border-radius:10px; }
.c-pbold .tier { border-radius:10px; }

.c-pbold { --a:#4a74ff; --b:#ff4d63; --as:linear-gradient(170deg,#25335f,#1a1d2c); --bs:linear-gradient(170deg,#5c2430,#221a1c); }
.c-pbold .card { background:#141414; color:#f5f2ec; padding:12px; border-radius:18px; box-shadow:0 18px 40px rgba(0,0,0,.28); }
.c-pbold .card .q { color:#fff; font-size:23px; }
.c-pbold .card .meta { color:#cfc9bf; opacity:.85; }
.c-pbold .img { border-radius:10px; box-shadow:0 8px 20px rgba(0,0,0,.45); }
.c-pbold .picked .img { box-shadow: inset 0 0 0 2px #fff, 0 0 26px rgba(74,116,255,.55); }
.c-pbold .vs { background:#faf8f5; color:#111; }
.c-pbold .card .lbl { color:#f5f2ec; }
.c-pbold .card .hint { color:#cfc9bf; }
.c-pbold .card .chip { background:#262626; color:#f5f2ec; } .c-pbold .card .chip.on { background:#fff; color:#111; }
.c-pbold .card .whyq { color:#cfc9bf; }
.c-pbold .card .win { background:rgba(240,180,60,.15); color:#f0c25a; }
.c-pbold .card .btn { background:#fff; color:#111; }
.c-pbold .peek { display:block; background:#2a2a2a; opacity:1; }
.c-pbold .chk { background:#fff; color:#111; }
""",
    "soft": r"""
.c-soft { --a:#6c4cff; --b:#ff3d8b; --as:#efeaff; --bs:#ffe8f1; --pp:#ffc93c; --pps:#fff4d6; --ppt:#7a5200;
 --card:#fff; --track:#f6e4e4; --rc:22px; --ri:16px; --rb:14px; --rchip:99px; --shadow:0 1px 2px rgba(60,20,60,.05), 0 8px 24px rgba(60,20,60,.07); --chip:#f8eef0; --btn:linear-gradient(90deg,#6c4cff,#ff3d8b); --btnfg:#fff;
 --vsbg:#fff; --vsfg:#24182f; --tabbg:#fff; --tabon:#ff3d8b; --line:#f3e6e6; --fd:'Bricolage Grotesque'; --fw:700; --fw2:600; --fieldshadow:0 0 0 1.5px #6c4cff; }
.c-soft.page { background:#fffaf8; color:#24182f; }
.c-soft .scr { background:#fff6f4; color:#24182f; }
.c-soft .title h2, .c-soft .typ .big { font-family:'Bricolage Grotesque'; font-weight:700; }
.c-soft .picked .img { box-shadow: inset 0 0 0 2.5px #6c4cff; }
.c-soft .chip.on { background:linear-gradient(90deg,#6c4cff,#ff3d8b); }
.c-soft .peek { background:#fff; opacity:.6; }
""",
    "honey": r"""
.c-honey { --a:#f2b200; --b:#ff6f59; --as:#fff3c9; --bs:#ffe5df; --pp:#ffc629; --pps:#fff3c9; --ppt:#6b4f00;
 --card:#fff; --track:#f1ece0; --rc:24px; --ri:18px; --rb:99px; --rchip:99px; --shadow:0 2px 10px rgba(40,30,0,.07); --chip:#f6f2e8; --btn:#ffc629; --btnfg:#1f1f1d;
 --vsbg:#1f1f1d; --vsfg:#ffc629; --tabbg:#fff; --tabon:#1f1f1d; --line:#f1ece0; --fd:'Figtree'; --fw:800; --fw2:600; --fieldshadow:0 0 0 2px #ffc629; }
.c-honey.page { background:#fffdf6; color:#1f1f1d; }
.c-honey .scr { background:#fffdf6; color:#1f1f1d; font-family:'Figtree'; }
.c-honey .title h2, .c-honey .typ .big { font-family:'Figtree'; font-weight:800; }
.c-honey .tag { color:#1f1f1d; border-radius:99px; } .c-honey .b .tag { color:#fff; }
.c-honey .chip.on { background:#ffc629; color:#1f1f1d; }
.c-honey .chk { background:#1f1f1d; color:#ffc629; }
.c-honey .picked .img { box-shadow: inset 0 0 0 3px #ffc629; }
.c-honey .tab.on svg { fill:#ffc629; }
.c-honey .mark b:first-child { background:#ffc629; } 
.c-honey .bigav { background:#ffc629; color:#1f1f1d; }
.c-honey .bar2 .ba { color:#1f1f1d; }
.c-honey .seg { border-radius:99px; } .c-honey .seg span { border-radius:99px; }
.c-honey .field { border-radius:16px; }
.c-honey .post .btn { font-weight:800; }
""",
    "members": r"""
.c-members { --a:#8fb8ff; --b:#f4a7bb; --as:linear-gradient(170deg,#1f3a73,#132453); --bs:linear-gradient(170deg,#5a3256,#2a2050); --pp:#d8b45c; --pps:rgba(216,180,92,.12); --ppt:#e6c777;
 --card:#16244a; --track:#22325e; --rc:16px; --ri:12px; --rb:10px; --rchip:6px; --shadow:0 0 0 1px rgba(255,255,255,.06); --chip:#1f2f5a; --btn:#ffffff; --btnfg:#0d1834;
 --vsbg:#0d1834; --vsfg:#d8b45c; --tabbg:#0b1530; --tabon:#ffffff; --line:#1d2b55; --fd:'Manrope'; --fw:700; --fw2:600; --fieldshadow:0 0 0 1px #8fb8ff; --labtt:uppercase; --labls:.14em; }
.c-members.page { background:#0a1430; color:#e9eefb; }
.c-members .scr { background:#0d1834; color:#e9eefb; font-family:'Manrope'; }
.c-members .title h2, .c-members .typ .big { font-family:'Manrope'; font-weight:700; letter-spacing:-.02em; }
.c-members .title h2 { color:#fff; }
.c-members .tag, .c-members .chk, .c-members .chip.on, .c-members .bar2 { color:#0d1834; }
.c-members .vs { box-shadow:0 0 0 1px #d8b45c; }
.c-members .btn { letter-spacing:.06em; text-transform:uppercase; font-size:10.5px; }
.c-members .win { border:1px solid rgba(216,180,92,.45); }
.c-members .seg .on { background:#2a3b6c; }
.c-members .pal .s i { box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
.c-members .bigav { background:#16244a; box-shadow:0 0 0 2px #d8b45c; color:#d8b45c; }
.c-members .sw i { background:#0d1834; }
.c-members .meta, .c-members .goal { letter-spacing:.02em; }
""",
    "prompt": r"""
.c-prompt { --a:#2f5ff0; --b:#e8384f; --as:#e8eefd; --bs:#fde9ec; --pp:#f0b43c; --pps:#fdf3dc; --ppt:#6e4a00;
 --card:#fff; --track:#ece8e2; --rc:10px; --ri:8px; --rb:99px; --rchip:99px; --shadow:0 0 0 1px #ece8e2; --chip:#f3f0eb; --btn:#111; --btnfg:#fff;
 --vsbg:#fff; --vsfg:#111; --tabbg:#fff; --tabon:#111; --line:#ece8e2; --fd:'Instrument Serif'; --fw:400; --fw2:400; --ls:0; --fieldshadow:0 1px 0 #111; }
.c-prompt.page { background:#faf8f5; color:#111; }
.c-prompt .scr { background:#faf8f5; color:#111; }
.c-prompt .title h2, .c-prompt .typ .big { font-family:'Instrument Serif'; font-weight:400; font-size:36px; }
.c-prompt .typ .big { font-size:26px; }
.c-prompt .q { font-size:21px; line-height:1.05; }
.c-prompt .vs { font:italic 400 13px 'Instrument Serif'; box-shadow:0 0 0 1px #ddd; }
.c-prompt .pct { font:400 30px 'Instrument Serif'; }
.c-prompt .name, .c-prompt .phdr, .c-prompt .stats b { font-family:'Instrument Serif'; font-weight:400; }
.c-prompt .name { font-size:22px; } .c-prompt .stats b { font-size:20px; } .c-prompt .phdr { font-size:19px; }
.c-prompt .field { border-radius:0; background:transparent; font-size:16px; padding:8px 0; }
.c-prompt .btn { font-family:Inter; font-weight:600; }
.c-prompt .chip.on { background:#111; }
.c-prompt .card { box-shadow:none; background:transparent; padding:6px 0 0; }
.c-prompt .peek { display:none; }
.c-prompt .picked .img { box-shadow: inset 0 0 0 2px #111; }
.c-prompt .chk { background:#111; }
.c-prompt .bigav { background:linear-gradient(135deg,#2f5ff0,#e8384f); }
.c-prompt .stats div, .c-prompt .row { box-shadow:0 0 0 1px #ece8e2; border-radius:10px; }
.c-prompt .tier { border-radius:10px; }
""",
    "sweet": r"""
.c-sweet { --a:#6c4cff; --b:#ff3d8b; --as:#efeaff; --bs:#ffe8f1; --pp:#ffc629; --pps:#fff3c9; --ppt:#6b4f00;
 --card:#fff; --track:#f6e4e4; --rc:22px; --ri:16px; --rb:99px; --rchip:99px; --shadow:0 1px 2px rgba(20,25,58,.05), 0 8px 24px rgba(20,25,58,.07); --chip:#f8eef0; --btn:#ffc629; --btnfg:#14193a;
 --vsbg:#14193a; --vsfg:#ffc629; --tabbg:#fff; --tabon:#ff3d8b; --line:#f3e6e6; --fd:'Instrument Serif'; --fw:400; --fw2:400; --ls:0; --fieldshadow:0 0 0 1.5px #6c4cff; }
.c-sweet.page { background:#fffaf8; color:#14193a; }
.c-sweet .scr { background:#fff6f4; color:#14193a; font-family:'Figtree'; }
.c-sweet .title h2, .c-sweet .typ .big { font-family:'Instrument Serif'; font-weight:400; font-size:36px; }
.c-sweet .typ .big { font-size:26px; }
.c-sweet .q { font-size:21px; line-height:1.05; }
.c-sweet .vs { font:italic 400 13px 'Instrument Serif'; }
.c-sweet .pct { font:400 30px 'Instrument Serif'; }
.c-sweet .name, .c-sweet .phdr, .c-sweet .stats b { font-family:'Instrument Serif'; font-weight:400; }
.c-sweet .name { font-size:22px; } .c-sweet .stats b { font-size:20px; } .c-sweet .phdr { font-size:19px; }
.c-sweet .btn { font-family:'Figtree'; font-weight:700; }
.c-sweet .chip.on { background:#6c4cff; }
.c-sweet .picked .img { box-shadow: inset 0 0 0 2.5px #6c4cff; }
.c-sweet .peek { background:#fff; opacity:.6; }
""",
    "base": r"""
.c-base { --a:#2f6bff; --b:#f0525a; --as:#eef2ff; --bs:#fff0f0; --pp:#f5a524; --pps:#fff6e0; --ppt:#9a5b00; --card:#f4f5f9; --bg:#fff; --ink:#1b2033;
 --track:#e6e8ef; --rc:16px; --ri:12px; --rb:8px; --rchip:6px; --shadow:0 0 0 1px #e6e8ef; --chip:#fff; --btn:#2f6bff; --btnfg:#fff; --vsbg:#fff; --vsfg:#1b2033;
 --tabbg:#fff; --tabon:#2f6bff; --line:#e6e8ef; --fd:Inter; --fw:500; --fieldshadow:0 0 0 1px #e1e3ea; }
.c-base .scr { background:#fff; color:#1b2033; }
.c-base .chip { box-shadow: 0 0 0 1px #e1e3ea; }
""",
    "pop": r"""
.c-pop { --a:#2e5bff; --b:#ff2e93; --as:linear-gradient(160deg,#dfe7ff,#b9c9ff); --bs:linear-gradient(160deg,#ffe0f0,#ffb3d8); --pp:#ffd400; --pps:#fff6c2; --ppt:#6b5000;
 --card:#fff; --track:#ffe3f0; --rc:24px; --ri:18px; --rb:14px; --rchip:99px; --shadow:0 8px 22px rgba(46,91,255,.14); --chip:#f3f0ff; --btn:linear-gradient(90deg,#2e5bff,#ff2e93); --btnfg:#fff;
 --vsbg:linear-gradient(135deg,#2e5bff,#ff2e93); --vsfg:#fff; --tabbg:#fff; --tabon:#ff2e93; --line:#f6e6ef; --fd:'Bricolage Grotesque'; --fw:800; --fw2:600; --fieldshadow:0 0 0 2px #2e5bff; }
.c-pop .scr { background:#fff1f7; color:#16113a; }
.c-pop .title h2, .c-pop .typ .big { font-family:'Bricolage Grotesque'; font-weight:800; }
.c-pop .vs { width:36px; height:36px; font-size:12px; transform:translate(-50%,-50%) rotate(-8deg); }
.c-pop .q { font-size:18px; }
.c-pop .pp { box-shadow: 0 0 0 2px #16113a; }
.c-pop .win { background:linear-gradient(90deg,#fff6c2,#ffe0f0); }
.c-pop .tag { border-radius:99px; }
.c-pop .peek { transform: rotate(3deg); background:#ffd400; opacity:1; }
.c-pop .card { transform: rotate(-1deg); }
""",
    "arcade": r"""
.c-arcade { --a:#2bd2ff; --b:#ff3cac; --as:radial-gradient(circle at 50% 40%,#1b4f6b,#141033); --bs:radial-gradient(circle at 50% 40%,#5a1a4c,#141033); --pp:#c6ff3d; --pps:rgba(198,255,61,.12); --ppt:#c6ff3d;
 --card:#1f1940; --track:#2c2556; --rc:18px; --ri:12px; --rb:10px; --rchip:6px; --shadow:0 0 0 1px #3a3170; --chip:#2c2556; --btn:#c6ff3d; --btnfg:#120e26;
 --vsbg:#120e26; --vsfg:#c6ff3d; --tabbg:#16112e; --tabon:#c6ff3d; --line:#2c2556; --fd:'Chakra Petch'; --fw:700; --fieldshadow:0 0 0 1px #2bd2ff,0 0 14px rgba(43,210,255,.35); --labtt:uppercase; --labls:.1em; }
.c-arcade.page { background:#0b0818; color:#eae6ff; }
.c-arcade .scr { background:radial-gradient(120% 60% at 50% 0%,#2a1d5c,#120e26 60%); color:#eae6ff; }
.c-arcade .title h2, .c-arcade .typ .big { font-family:'Chakra Petch'; font-weight:700; color:#c6ff3d; text-shadow:0 0 18px rgba(198,255,61,.45); }
.c-arcade .frame { background:#000; box-shadow:0 0 0 1px #3a3170, 0 0 40px rgba(255,60,172,.25); }
.c-arcade .vs { box-shadow:0 0 0 2px #c6ff3d, 0 0 14px rgba(198,255,61,.6); }
.c-arcade .opt.a .img { box-shadow: inset 0 0 0 1.5px rgba(43,210,255,.6), 0 0 18px rgba(43,210,255,.25); }
.c-arcade .opt.b .img { box-shadow: inset 0 0 0 1.5px rgba(255,60,172,.6), 0 0 18px rgba(255,60,172,.25); }
.c-arcade .picked .img { box-shadow: inset 0 0 0 3px #2bd2ff, 0 0 26px rgba(43,210,255,.6); }
.c-arcade .tag, .c-arcade .chk { color:#120e26; }
.c-arcade .chip.on { color:#120e26; }
.c-arcade .prog { height:7px; } .c-arcade .prog i { box-shadow:0 0 10px #c6ff3d; }
.c-arcade .win { border:1px solid #c6ff3d; }
.c-arcade .pct { color:#fff; text-shadow:0 0 12px rgba(0,0,0,.6); }
.c-arcade .seg .on { background:#3a3170; }
.c-arcade .sw i { background:#120e26; }
.c-arcade .pal .s i { box-shadow: inset 0 0 0 1px rgba(255,255,255,.18); }
.c-arcade .bar2 { color:#120e26; }
""",
    "candy": r"""
.c-candy { --a:#7b5cff; --b:#ff7a1a; --as:#e9e2ff; --bs:#ffe4cf; --pp:#ffc531; --pps:#fff0c2; --ppt:#7a4f00;
 --card:#fff; --track:#f3e3cc; --rc:26px; --ri:20px; --rb:16px; --rchip:99px; --shadow:0 4px 0 #ecd9bf; --chip:#fbead3; --btn:#ff7a1a; --btnfg:#fff;
 --vsbg:#ffc531; --vsfg:#3a2a1f; --tabbg:#fffaf2; --tabon:#7b5cff; --line:#f3e3cc; --fd:'Fredoka'; --fw:600; --fieldshadow:0 0 0 2px #3a2a1f, 0 3px 0 #3a2a1f; }
.c-candy.page { background:#fffaf2; color:#3a2a1f; }
.c-candy .scr { background:#fff6e9; color:#3a2a1f; font-family:Nunito, sans-serif; }
.c-candy .title h2, .c-candy .typ .big { font-family:'Fredoka'; font-weight:600; }
.c-candy .card { border:2px solid #3a2a1f; box-shadow:0 5px 0 #3a2a1f; }
.c-candy .peek { border:2px solid #3a2a1f; background:#ffc531; opacity:1; transform:rotate(-3deg); }
.c-candy .btn { box-shadow:0 4px 0 #b44f00; }
.c-candy .vs { border:2px solid #3a2a1f; transform:translate(-50%,-50%) rotate(-12deg); width:34px; height:34px; }
.c-candy .opt .img { border:2px solid #3a2a1f; }
.c-candy .tag { border-radius:99px; }
.c-candy .badges span { background:#fff; border:2px solid #3a2a1f; transform:rotate(-3deg); font-weight:700; }
.c-candy .badges span:last-child { transform:rotate(4deg); }
.c-candy .stats div, .c-candy .row, .c-candy .slot { border:2px solid #3a2a1f; box-shadow:0 3px 0 #3a2a1f; }
.c-candy .chip { font-weight:700; }
.c-candy .tier { border:2px solid #3a2a1f; }
""",
    "brutal": r"""
.c-brutal { --a:#3d5afe; --b:#ff4b3e; --as:#c9d2ff; --bs:#ffc9c4; --pp:#ffe600; --pps:#ffe600; --ppt:#111;
 --card:#fff; --track:#fff; --rc:6px; --ri:4px; --rb:4px; --rchip:3px; --shadow:3px 3px 0 #111; --chip:#fff; --btn:#ffe600; --btnfg:#111;
 --vsbg:#111; --vsfg:#ffe600; --tabbg:#fffdf5; --tabon:#111; --line:#111; --fd:'Archivo Black'; --fw:400; --fieldshadow:3px 3px 0 #111; --ls:-.005em; --labtt:uppercase; --labls:.08em; }
.c-brutal.page { background:#fffdf5; color:#111; }
.c-brutal .scr { background:#fffdf5; color:#111; font-family:'Space Grotesk', sans-serif; }
.c-brutal .title h2, .c-brutal .typ .big { font-family:'Archivo Black'; font-weight:400; }
.c-brutal .card, .c-brutal .opt .img, .c-brutal .field, .c-brutal .slot, .c-brutal .stats div, .c-brutal .row, .c-brutal .chip, .c-brutal .btn, .c-brutal .pp, .c-brutal .win, .c-brutal .tier, .c-brutal .boost, .c-brutal .seg, .c-brutal .prog, .c-brutal .badges span { border:2px solid #111; }
.c-brutal .card { box-shadow:5px 5px 0 #111; }
.c-brutal .opt .img { box-shadow:none; }
.c-brutal .btn { box-shadow:4px 4px 0 #111; text-transform:uppercase; letter-spacing:.04em; }
.c-brutal .peek { border:2px solid #111; background:#ff4b3e; opacity:1; transform:translate(6px,4px); }
.c-brutal .vs { border-radius:4px; transform:translate(-50%,-50%) rotate(-6deg); box-shadow:2px 2px 0 #ffe600; }
.c-brutal .tag { border-radius:2px; border:1.5px solid #111; }
.c-brutal .chip.on { background:#3d5afe; }
.c-brutal .prog { height:9px; } .c-brutal .prog i { background:#3d5afe; border-radius:0; }
.c-brutal .picked .img { box-shadow: inset 0 0 0 3px #111; }
.c-brutal .chk { background:#ffe600; color:#111; border:2px solid #111; border-radius:3px; }
.c-brutal .tabbar { border-top:2px solid #111; }
.c-brutal .bigav { border:2px solid #111; border-radius:6px; box-shadow:3px 3px 0 #111; }
.c-brutal .bar2 { border:2px solid #111; border-radius:2px; height:16px; }
.c-brutal .tbar i, .c-brutal .sw { background:#3d5afe; }
.c-brutal .pal .s i { border:2px solid #111; border-radius:4px; box-shadow:3px 3px 0 #111; }
""",
    "aurora": r"""
.c-aurora { --a:#14b8a6; --b:#8b5cf6; --as:linear-gradient(160deg,rgba(20,184,166,.25),rgba(255,255,255,.4)); --bs:linear-gradient(160deg,rgba(139,92,246,.28),rgba(255,255,255,.4)); --pp:#ff9f6e; --pps:rgba(255,159,110,.2); --ppt:#a2431a;
 --card:rgba(255,255,255,.58); --track:rgba(255,255,255,.6); --rc:24px; --ri:18px; --rb:14px; --rchip:99px; --shadow:0 0 0 1px rgba(255,255,255,.7), 0 10px 30px rgba(60,40,140,.12); --chip:rgba(255,255,255,.65);
 --btn:#1e1b3a; --btnfg:#fff; --vsbg:rgba(255,255,255,.85); --vsfg:#1e1b3a; --tabbg:rgba(255,255,255,.55); --tabon:#8b5cf6; --line:rgba(255,255,255,.7); --fd:'Plus Jakarta Sans'; --fw:800; --fw2:600; --fieldshadow:0 0 0 1px rgba(255,255,255,.9), 0 6px 20px rgba(60,40,140,.1); }
.c-aurora.page { background:radial-gradient(60% 80% at 10% 0%,#e3fbf7,transparent),radial-gradient(60% 80% at 100% 100%,#efe6ff,transparent),#f7f8ff; color:#1e1b3a; }
.c-aurora .scr { color:#1e1b3a; font-family:'Plus Jakarta Sans'; background:
 radial-gradient(80% 45% at 0% 10%, rgba(20,184,166,.55), transparent 70%),
 radial-gradient(70% 45% at 100% 30%, rgba(139,92,246,.55), transparent 70%),
 radial-gradient(90% 50% at 40% 100%, rgba(255,159,110,.55), transparent 70%), #eef1ff; }
.c-aurora .title h2, .c-aurora .typ .big { font-family:'Plus Jakarta Sans'; font-weight:800; background:linear-gradient(90deg,#14b8a6,#8b5cf6,#ff9f6e); -webkit-background-clip:text; color:transparent; }
.c-aurora .card, .c-aurora .stats div, .c-aurora .row, .c-aurora .slot, .c-aurora .field { backdrop-filter: blur(14px); }
.c-aurora .chip.on { background:linear-gradient(90deg,#14b8a6,#8b5cf6); }
.c-aurora .prog i { background:linear-gradient(90deg,#14b8a6,#8b5cf6,#ff9f6e); }
.c-aurora .win { background:rgba(255,255,255,.7); }
.c-aurora .pp { background:rgba(255,255,255,.7); }
.c-aurora .tier { background:rgba(255,255,255,.55); }
.c-aurora .tbar i { background:linear-gradient(90deg,#14b8a6,#8b5cf6,#ff9f6e); }
.c-aurora .peek { background:rgba(255,255,255,.35); opacity:1; }
""",
    "versus": r"""
.c-versus { --a:#ff3b30; --b:#0a84ff; --as:linear-gradient(160deg,#ff6a5f,#d81f14); --bs:linear-gradient(160deg,#3ea0ff,#0060d0); --pp:#e8ff00; --pps:#0b0b0f; --ppt:#e8ff00;
 --card:#fff; --track:#ddd; --rc:10px; --ri:6px; --rb:6px; --rchip:4px; --shadow:0 1px 0 #ddd; --chip:#ececec; --btn:#0b0b0f; --btnfg:#e8ff00;
 --vsbg:#e8ff00; --vsfg:#0b0b0f; --tabbg:#0b0b0f; --tabon:#e8ff00; --line:#0b0b0f; --fd:'Anton'; --fw:400; --ls:.01em; --fieldshadow:0 0 0 2px #0b0b0f; --labtt:uppercase; --labls:.1em; }
.c-versus.page { background:#f2f2f2; color:#0b0b0f; }
.c-versus .scr { background:#f2f2f2; color:#0b0b0f; }
.c-versus .title h2, .c-versus .typ .big { font-family:'Anton'; font-weight:400; text-transform:uppercase; letter-spacing:.01em; }
.c-versus .q { text-transform:uppercase; font-size:19px; line-height:1.05; }
.c-versus .tab { color:#fff; } .c-versus .tab.on { color:#e8ff00; }
.c-versus .opts { gap:0; }
.c-versus .opt.a .img { border-radius:6px 0 0 6px; clip-path:polygon(0 0,100% 0,88% 100%,0 100%); margin-right:-10px; }
.c-versus .opt.b .img { border-radius:0 6px 6px 0; clip-path:polygon(12% 0,100% 0,100% 100%,0 100%); margin-left:-10px; }
.c-versus .opt.b .lbl { justify-content:flex-end; }
.c-versus .opt .img span { filter: drop-shadow(0 4px 6px rgba(0,0,0,.3)); }
.c-versus .vs { width:38px; height:38px; font:400 15px 'Anton'; transform:translate(-50%,-50%) skew(-8deg); border-radius:4px; }
.c-versus .pct { font:400 34px/1 'Anton'; background:none !important; }
.c-versus .opt.b .pct { text-align:right; }
.c-versus .picked .img { box-shadow:none; filter: saturate(1.2); }
.c-versus .opt.b.res .img { filter: grayscale(.6) brightness(.9); }
.c-versus .chk { background:#e8ff00; color:#0b0b0f; }
.c-versus .btn { font:400 14px 'Anton'; letter-spacing:.06em; text-transform:uppercase; }
.c-versus .pp { border-radius:4px; }
.c-versus .win { text-transform:uppercase; letter-spacing:.04em; font-size:10px; }
.c-versus .stats b { font-size:20px; }
.c-versus .name { text-transform:uppercase; font-size:20px; }
.c-versus .phdr { text-transform:uppercase; font-size:16px; }
.c-versus .bigav { border-radius:8px; transform:skew(-6deg); }
.c-versus .peek { display:none; }
.c-versus .tbar { background:#333; }
""",
}


def concept_page(c):
    sw = "".join(f'<div class="s"><i style="background:{hx}"></i><span>{nm}</span><small>{hx}</small></div>' for nm, hx in c["palette"])
    why = "".join(f"<li>{w}</li>" for w in c["why"])
    phones = "".join(f'<div class="ph"><div class="cap">{cap}</div><div class="frame">{fn()}</div></div>' for cap, fn in SCREENS)
    bolts = "⚡" * c["energy"] + '<span style="opacity:.25">' + "⚡" * (5 - c["energy"]) + "</span>"
    kick = "Revert point" if c["id"] == "base" else "Concept"
    return f'''<section class="page c-{c["id"]}">
<div class="top">
 <div class="title"><div class="kick">{kick}</div><h2>{c["name"]}</h2><p>{c["tag"]}</p><div class="energy">Energy {bolts}</div></div>
 <div class="pal"><h4>Palette</h4><div class="swatches">{sw}</div><div class="typ"><div class="big" style="font-family:var(--fd);font-weight:var(--fw)">{c["type_sample"]}</div><div class="nm">{c["type_name"]}</div></div></div>
 <div class="why"><h4>Why it works</h4><ul>{why}</ul></div>
</div>
<div class="phones">{phones}</div>
<div class="foot">crowdpick.ai · redesign concepts · Nov 2026</div>
</section>'''


def cover():
    tiles = ""
    for c in CONCEPTS[1:]:
        cols = "".join(f'<i style="background:{hx}"></i>' for _, hx in c["palette"][:3])
        tiles += f'<div class="tile c-{c["id"]}"><div class="tc">{cols}</div><b style="font-family:var(--fd);font-weight:var(--fw)">{c["name"]}</b><span>{c["tag"]}</span></div>'
    return f'''<section class="page cover">
<div class="ck">crowdpick.ai</div>
<h1>Make it <span class="g">vibrant.</span><br>Six redesign concepts.</h1>
<p class="lead">Each concept restyles the same four screens: the vote deck, the result after you pick, the Post composer and the You profile. Same features, same flows; only the look and feel change. Pick one (or mix parts) and we’ll build it. Some mock details (streaks, badges, boost toggle) are illustrative ideas, not features that exist yet.</p>
<div class="tiles">{tiles}</div>
<div class="note"><b>Today’s look is saved.</b> The current design is the revert point at <code>main @ 22fb559</code>, with its full token file in <code>docs/design/base-design.md</code>. Page 2 shows it for comparison.</div>
</section>'''


def compare():
    rows = ""
    data = {
        "pop": ("Light", "Low", "1 day", "Everyone; safest upgrade"),
        "arcade": ("Dark", "Medium", "2–3 days", "Younger, game-loving users"),
        "candy": ("Light (cream)", "Medium", "2 days", "Parents; warm and friendly"),
        "brutal": ("Light (paper)", "Medium", "2 days", "Trend-savvy, social sharing"),
        "aurora": ("Light (gradient)", "Medium", "2–3 days", "Premium feel, brand battles"),
        "versus": ("Light + black", "High", "3–4 days", "Maximum drama and shareability"),
    }
    for c in CONCEPTS[1:]:
        th, ch, ef, fit = data[c["id"]]
        dots = "".join(f'<i style="background:{hx}"></i>' for _, hx in c["palette"][:3])
        bolts = "⚡" * c["energy"]
        rows += f"<tr><td><span class='dots3'>{dots}</span><b>{c['name']}</b></td><td>{th}</td><td>{bolts}</td><td>{ch}</td><td>{ef}</td><td>{fit}</td></tr>"
    return f'''<section class="page cover cmp">
<div class="ck">Side by side</div>
<h1 style="font-size:40px">How they compare</h1>
<table><thead><tr><th>Concept</th><th>Theme</th><th>Energy</th><th>Change from today</th><th>Rough build</th><th>Best for</th></tr></thead><tbody>{rows}</tbody></table>
<div class="next"><h4>How to choose</h4>
<ul><li>Want a quick, safe lift? <b>Pop Fizz</b>.</li>
<li>Want voting to feel like a game, and the dark theme from the Swipe PRD? <b>Arcade Night</b>.</li>
<li>Want parents to feel at home? <b>Sticker Club</b>.</li>
<li>Mixing is fine, e.g. Pop Fizz colours with Versus-style split cards.</li></ul>
<p>Build estimates cover the styling only (tokens, fonts, components). Every concept keeps the current 3-tab layout (Vote, Post, You), so no flows change, and we can switch back to the saved base design at any time.</p></div>
</section>'''


COVER_CSS = r"""
.cover { padding: 56px 64px; background: radial-gradient(50% 70% at 100% 0%, #ffe0f0, transparent), radial-gradient(50% 70% at 0% 100%, #dfe7ff, transparent), #fff; }
.cover .ck { font: 600 12px Inter; letter-spacing: .16em; text-transform: uppercase; opacity: .55; }
.cover h1 { font: 800 54px/1.02 'Bricolage Grotesque'; letter-spacing: -.03em; margin: 14px 0 16px; color: #16113a; }
.cover .g { background: linear-gradient(90deg,#2e5bff,#ff2e93,#ff9f1a); -webkit-background-clip: text; color: transparent; }
.cover .lead { font: 400 15px/1.5 Inter; max-width: 720px; opacity: .8; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 30px; }
.tile { border-radius: 16px; padding: 14px 16px; background: #fff; box-shadow: 0 0 0 1px #eceaf5, 0 8px 20px rgba(30,20,90,.06); }
.tile .tc { display: flex; gap: 4px; margin-bottom: 9px; } .tile .tc i { width: 30px; height: 12px; border-radius: 4px; }
.tile b { display: block; font-size: 17px; margin-bottom: 3px; }
.tile.c-versus b { text-transform: uppercase; }
.tile span { font: 400 11.5px/1.4 Inter; opacity: .7; }
.note { position: absolute; left: 64px; right: 64px; bottom: 40px; font: 400 12.5px/1.5 Inter; padding: 12px 16px; border-radius: 12px; background: #f4f5f9; }
.note code, .cmp code { font: 500 11.5px ui-monospace, monospace; background: #fff; padding: 1px 5px; border-radius: 4px; }
.cmp table { width: 100%; border-collapse: collapse; margin-top: 18px; font: 400 13px Inter; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 1px #eceaf5; }
.cmp th { text-align: left; font: 600 10.5px Inter; letter-spacing: .1em; text-transform: uppercase; opacity: .6; padding: 12px 14px; background: #fafaff; }
.cmp td { padding: 11px 14px; border-top: 1px solid #f0eff7; }
.cmp td b { font-weight: 600; }
.dots3 { display: inline-flex; gap: 3px; margin-right: 10px; vertical-align: -1px; } .dots3 i { width: 11px; height: 11px; border-radius: 50%; }
.next { margin-top: 22px; font: 400 13px/1.5 Inter; display: grid; grid-template-columns: 1fr; }
.next h4 { font: 600 11px Inter; letter-spacing: .12em; text-transform: uppercase; opacity: .55; margin-bottom: 6px; }
.next ul { margin: 0 0 8px 18px; } .next p { opacity: .7; max-width: 900px; font-size: 12px; }
"""



def drag_screen(wa, cap_in, state=""):
    """wa = width share of option A in percent."""
    wb = 100 - wa
    arrow = ""
    if state == "right": arrow = '<div class="dhint r">Drag right → picks B</div>'
    if state == "left": arrow = '<div class="dhint l">← Drag back to switch</div>'
    if state == "release": arrow = '<div class="dhint r go">Let go to pick B</div>'
    pctA = f'<b class="dp">{wa}%</b>' if state not in ("", "picked") else ""
    a_cls = "dA" + (" hot" if wa >= 62 else "")
    b_cls = "dB" + (" hot" if wb >= 62 else "")
    if state == "picked":
        body = f'''<div class="dsplit fly"><div class="dB full"><span>👒</span><div class="dres"><b>36%</b> picked Bucket hat<br><small>with you</small></div><div class="chk">✓</div></div></div>'''
    else:
        body = f'''<div class="dsplit"><div class="{a_cls}{' narrow' if wa < 30 else ''}" style="width:{wa}%"><span>🕶️</span><i class="dl">A · Retro shades</i></div><div class="{b_cls}{' narrow' if wb < 30 else ''}" style="width:{wb}%"><span>👒</span><i class="dl">B · Bucket hat</i></div></div>'''
    return f'''<div class="scr drag">{header()}
<div class="q dq">Which one for the beach trip?</div>
<div class="dmeta"><span class="av">M</span>@maya · 2h left</div>
{body}{arrow}{tabbar("Vote")}</div>'''


DRAG_FRAMES = [
    ("1 · At rest: 50 / 50", lambda: drag_screen(50, "", "")),
    ("2 · Drag right: B grows", lambda: drag_screen(34, "", "right")),
    ("3 · Drag back left: A grows", lambda: drag_screen(66, "", "left")),
    ("4 · Nearly all B", lambda: drag_screen(12, "", "release")),
    ("5 · Let go: B fills and flies off", lambda: drag_screen(0, "", "picked")),
]

DRAG_CSS = r"""
.drag .dq { font-size: 17px; margin: 4px 0 4px; }
.dmeta { display:flex; align-items:center; gap:5px; font-size:9.5px; opacity:.7; margin-bottom:9px; }
.dsplit { position:relative; height:318px; border-radius:20px; overflow:hidden; display:flex; box-shadow:var(--shadow); }
.dsplit > div { position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden; transition:width .2s; }
.dsplit span { font-size:58px; }
.dA { background:var(--as); }
.dB { background:var(--bs); }
.dA.hot { box-shadow: inset 0 0 0 3px var(--a); }
.dB.hot { box-shadow: inset 0 0 0 3px var(--b); }
.dl { position:absolute; left:6px; bottom:8px; font-style:normal; font-size:8.5px; font-weight:600; background:rgba(255,255,255,.9); padding:3px 7px; border-radius:99px; white-space:nowrap; }
.dB .dl { left:auto; right:8px; }
.dB.full { width:100%; }
.dsplit.fly { transform: translateX(46px) rotate(7deg); }
.dres { position:absolute; left:12px; bottom:12px; font-size:10px; line-height:1.3; }
.dres b { font: var(--fw) 28px var(--fd); display:block; color:var(--b); }
.dhint { margin-top:10px; text-align:center; font-size:10.5px; font-weight:600; padding:7px; border-radius:12px; background:var(--chip); }
.dhint.go { background:var(--btn); color:#fff; }
.dpage .ph { width: 200px; } .dpage .frame { width:200px; height:486px; border-radius:30px; }
.dpage .scr { width:186px; height:472px; padding:28px 10px 0; border-radius:24px; }
.dpage .dsplit { height:262px; }
.dsplit .narrow .dl { display:none; }
.dpage .dsplit span { font-size:46px; }
.dpage .ph .cap { text-transform:none; letter-spacing:0; font-size:11px; opacity:.8; }
.dnotes { display:grid; grid-template-columns: repeat(3, 1fr); gap:22px; font: 400 12px/1.45 Inter; margin-bottom: 18px; }
.dnotes b { display:block; font-weight:600; margin-bottom:3px; color:var(--b); }
"""


def drag_page():
    phones = "".join(f'<div class="ph"><div class="cap">{cap}</div><div class="frame">{fn()}</div></div>' for cap, fn in DRAG_FRAMES)
    return f'''<section class="page c-prompt dpage">
<div class="title" style="width:auto"><div class="kick">Interaction</div><h2>Drag to grow</h2></div>
<div class="dnotes">
<div><b>The photo follows your finger</b>Both photos share the card. Drag right and the right photo (B) widens while A shrinks. At rest it is 50 / 50.</div>
<div><b>Change your mind any time</b>Drag back the other way and the split follows. Nothing is counted until you let go past the line (about 80 / 20).</div>
<div><b>Let go to pick</b>The winning photo fills the whole card, shows the crowd result, then slides off so the next battle comes in. Tapping a photo does the same with a quick animation.</div>
</div>
<div class="phones">{phones}</div>
<div class="foot">crowdpick.ai · Prompt · Red &amp; Blue · Nov 2026</div>
</section>'''


def main():
    fams = "&family=".join(sorted({c["fonts"] for c in CONCEPTS} | {"Nunito:wght@500;700"}))
    css = BASE_CSS + "".join(THEME_CSS.values()) + COVER_CSS + DRAG_CSS
    pages = "".join(concept_page(c) for c in CONCEPTS)
    html = f'''<!doctype html><html><head><meta charset="utf-8"><title>crowdpick.ai redesign concepts</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={fams}&display=block">
<style>{css}</style></head><body>{pages}</body></html>'''
    OUT.write_text(html)
    print(OUT)


if __name__ == "__main__":
    main()
