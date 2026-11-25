/**
 * Lifecycle email templates (docs/emails.md). Each builder returns subject + preheader + html + text; the mailer adds
 * the footer (why you got it, one-click unsubscribe for the group, settings, postal address) and UTM tags on links.
 */
import { escapeHtml as esc } from "./email";

const INK = "#17161A";
const MUTED = "#6B6770";
const A = "#2F5FF0";
const B = "#E8384F";
const PAGE = "#F6F2EC";

export type Built = { subject: string; preheader: string; body: string; text: string };
export type Footer = { why: string; unsubscribeUrl: string | null; settingsUrl: string; postalAddress: string | null };

/** Wrap a template body in the branded layout. */
export function layout(b: Built, f: Footer): { html: string; text: string } {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><meta charset="utf-8"></head>
<body style="margin:0;background:${PAGE};font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;color:${INK}">
<span style="display:none!important;opacity:0;color:transparent;max-height:0;overflow:hidden">${esc(b.preheader)}</span>
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="font-size:22px;font-weight:600;letter-spacing:-0.5px;margin:0 0 16px 4px">crowd<span style="color:${A}">pick</span></div>
<div style="background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 1px 2px rgba(0,0,0,.04)">${b.body}</div>
<div style="color:${MUTED};font-size:12px;line-height:1.6;margin:18px 6px 0">
${esc(f.why)}<br>
${f.unsubscribeUrl ? `<a href="${f.unsubscribeUrl}" style="color:${MUTED}">Unsubscribe from these</a> · ` : ""}<a href="${f.settingsUrl}" style="color:${MUTED}">Email settings</a>
${f.postalAddress ? `<br>crowdpick.ai · ${esc(f.postalAddress)}` : ""}
</div></div></body></html>`;
  const text = `${b.text}\n\n—\n${f.why}\n${f.unsubscribeUrl ? `Unsubscribe from these: ${f.unsubscribeUrl}\n` : ""}Email settings: ${f.settingsUrl}${f.postalAddress ? `\ncrowdpick.ai · ${f.postalAddress}` : ""}`;
  return { html, text };
}

const h1 = (t: string) => `<h1 style="font-size:24px;line-height:1.25;font-weight:600;margin:0 0 12px">${t}</h1>`;
const p = (t: string, muted = false) => `<p style="font-size:16px;line-height:1.5;margin:0 0 14px;color:${muted ? MUTED : INK}">${t}</p>`;
const btn = (href: string, label: string, color = INK) =>
  `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:600;font-size:15px;margin:6px 6px 6px 0">${esc(label)}</a>`;
const quote = (t: string) => `<div style="border-left:3px solid #E7E1D8;padding:4px 0 4px 12px;margin:0 0 14px;color:${MUTED};font-size:15px;font-style:italic">“${esc(t)}”</div>`;

function splitBar(labelA: string, labelB: string, pctA: number) {
  const pctB = 100 - pctA;
  return `<div style="margin:6px 0 16px">
<div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px"><span style="color:${A};font-weight:600">${esc(labelA)} · ${pctA}%</span><span style="color:${B};font-weight:600">${pctB}% · ${esc(labelB)}</span></div>
<div style="height:8px;border-radius:99px;background:${B};overflow:hidden"><div style="height:8px;width:${pctA}%;background:${A}"></div></div></div>`;
}
const pctOf = (a: number, b: number) => (a + b ? Math.round((100 * a) / (a + b)) : 50);
const listItem = (href: string, title: string, sub?: string) =>
  `<a href="${href}" style="display:block;text-decoration:none;color:${INK};padding:12px 0;border-top:1px solid #F0EBE4"><span style="font-size:15px;font-weight:600">${esc(title)}</span>${sub ? `<br><span style="font-size:13px;color:${MUTED}">${esc(sub)}</span>` : ""}</a>`;

// ---------------- Your battles ----------------

export function battleLive(o: { title: string; url: string; shareText: string }): Built {
  const wa = `https://wa.me/?text=${encodeURIComponent(`${o.shareText} ${o.url}`)}`;
  return {
    subject: "Your battle is live 🎉",
    preheader: "Send it to 2–3 friends — they answer fastest.",
    body: `${h1("Your battle is live")}${p(`<b>${esc(o.title)}</b>`)}${p("Friends answer fastest. Send it to two or three people who know the situation.", true)}
${btn(o.url, "Open & share")} ${btn(wa, "Share on WhatsApp", "#25A04A")}`,
    text: `Your battle is live: ${o.title}\nShare it: ${o.url}`,
  };
}

export function voteMilestone(o: { title: string; url: string; n: number; labelA: string; labelB: string; votesA: number; votesB: number; topReason: string | null }): Built {
  const first = o.n === 1;
  const lead = o.votesA === o.votesB ? null : o.votesA > o.votesB ? o.labelA : o.labelB;
  const pa = pctOf(o.votesA, o.votesB);
  return {
    subject: first ? "Your first vote is in" : `${o.n} people weighed in on “${o.title}”`,
    preheader: first ? "Someone picked a side. See why →" : lead ? `${lead} leads with ${Math.max(pa, 100 - pa)}%.` : "It's neck and neck.",
    body: `${h1(first ? "Your first vote is in" : `${o.n} people weighed in`)}${p(`<b>${esc(o.title)}</b>`)}
${first ? "" : splitBar(o.labelA, o.labelB, pa)}${o.topReason ? quote(o.topReason) : ""}${btn(o.url, "See results")}`,
    text: `${first ? "Your first vote is in" : `${o.n} people weighed in`}: ${o.title}\n${o.url}`,
  };
}

export function needsVotes(o: { title: string; url: string; votes: number }): Built {
  return {
    subject: `“${o.title}” could use a few more votes`,
    preheader: "Friends answer fastest — send it to a few more people.",
    body: `${h1("Your battle needs a few more votes")}${p(`<b>${esc(o.title)}</b> has ${o.votes} vote${o.votes === 1 ? "" : "s"} so far and it's halfway through.`)}
${p("Friends answer fastest — send it to a few more people. Voting on other battles also raises your priority.", true)}${btn(o.url, "Share again")}`,
    text: `${o.title} has ${o.votes} votes so far. Share it again: ${o.url}`,
  };
}

export function resultsIn(o: {
  title: string;
  reportUrl: string;
  labelA: string;
  labelB: string;
  votesA: number;
  votesB: number;
  reasons: string[];
  loopPoints: number;
}): Built {
  const pa = pctOf(o.votesA, o.votesB);
  const winner = o.votesA === o.votesB ? null : o.votesA > o.votesB ? o.labelA : o.labelB;
  const u = (c: string) => `${o.reportUrl}${o.reportUrl.includes("?") ? "&" : "?"}c=${c}`;
  return {
    subject: `Results are in: ${o.title}`,
    preheader: winner ? `${winner} won ${Math.max(pa, 100 - pa)}%. Which did you pick? (+${o.loopPoints} points)` : `It's a tie. Which did you pick? (+${o.loopPoints} points)`,
    body: `${h1("Results are in")}${p(`<b>${esc(o.title)}</b> · ${o.votesA + o.votesB} votes`)}${splitBar(o.labelA, o.labelB, pa)}
${o.reasons.map(quote).join("")}${p(`Which did you pick? Tell everyone and earn <b>+${o.loopPoints} ⚡</b>.`)}
${btn(u("A"), `I picked ${o.labelA}`, A)}${btn(u("B"), `I picked ${o.labelB}`, B)}${btn(u("NEITHER"), "Neither", MUTED)}`,
    text: `Results are in: ${o.title}\n${o.labelA} ${pa}% · ${o.labelB} ${100 - pa}%\nWhich did you pick? ${o.reportUrl}`,
  };
}

export function pickbotResults(o: { title: string; url: string; labelA: string; labelB: string; votesA: number; votesB: number; agreed: boolean | null }): Built {
  const pa = pctOf(o.votesA, o.votesB);
  const winner = o.votesA === o.votesB ? null : o.votesA > o.votesB ? o.labelA : o.labelB;
  const line = o.agreed === true ? "The crowd agreed with Pickbot." : o.agreed === false ? "The crowd went the other way from Pickbot." : "";
  return {
    subject: `The crowd answered: ${o.title}`,
    preheader: winner ? `${winner} won ${Math.max(pa, 100 - pa)}%. ${line}` : `It's a tie. ${line}`,
    body: `${h1("The crowd is in")}${p(`<b>${esc(o.title)}</b> · ${o.votesA + o.votesB} votes`)}${splitBar(o.labelA, o.labelB, pa)}${line ? p(line) : ""}${p("See how people like you voted, and tell us what you picked.", true)}
${btn(o.url, "See the results", A)}`,
    text: `The crowd answered: ${o.title}\n${o.labelA} ${pa}% · ${o.labelB} ${100 - pa}%\n${o.url}`,
  };
}

export function loopReminder(o: { title: string; reportUrl: string; labelA: string; labelB: string; n: number; loopPoints: number }): Built {
  const u = (c: string) => `${o.reportUrl}${o.reportUrl.includes("?") ? "&" : "?"}c=${c}`;
  return {
    subject: `Which did you pick? “${o.title}”`,
    preheader: "Your voters want to know how it turned out.",
    body: `${h1("Which did you pick?")}${p(`<b>${esc(o.title)}</b>`)}${p(`Your voters want to know how it turned out. It takes 5 seconds and earns <b>+${o.loopPoints} ⚡</b>. Open loops push your next battles down.`, true)}
${btn(u("A"), `I picked ${o.labelA}`, A)}${btn(u("B"), `I picked ${o.labelB}`, B)}${btn(u("NEITHER"), "Neither", MUTED)}`,
    text: `Which did you pick? ${o.title}\n${o.reportUrl}`,
  };
}

// ---------------- Battles you voted on ----------------

export type VoterOutcome = { title: string; url: string; poster: string; picked: string | null; thumb: "UP" | "DOWN" | null; calledIt: boolean; points: number; note: string | null };
export type HelpfulItem = { title: string; url: string; points: number };

export function voterUpdates(o: { outcomes: VoterOutcome[]; helpful: HelpfulItem[] }): Built {
  const one = o.outcomes.length === 1 && !o.helpful.length ? o.outcomes[0] : null;
  const called = o.outcomes.filter((x) => x.calledIt).length;
  const subject = one
    ? one.calledIt
      ? `${one.poster} picked ${one.picked} — you called it!`
      : `${one.poster} decided: ${one.picked ?? "neither"}`
    : o.outcomes.length
      ? `${o.outcomes.length} battle${o.outcomes.length > 1 ? "s" : ""} you voted on have an outcome`
      : "Your reason helped someone decide";
  const outcomeHtml = o.outcomes
    .map(
      (x) => `<div style="padding:12px 0;border-top:1px solid #F0EBE4">
<a href="${x.url}" style="color:${INK};text-decoration:none;font-weight:600;font-size:15px">${esc(x.title)}</a><br>
<span style="font-size:14px">${esc(x.poster)} picked <b>${esc(x.picked ?? "neither")}</b>${x.thumb === "UP" ? " 👍" : x.thumb === "DOWN" ? " 👎" : ""}${x.calledIt ? ` · <span style="color:#1E9E57;font-weight:600">You called it! +${x.points} ⚡</span>` : ""}</span>
${x.note ? `<br><span style="font-size:14px;color:${MUTED};font-style:italic">“${esc(x.note)}”</span>` : ""}</div>`,
    )
    .join("");
  const helpfulHtml = o.helpful.map((x) => listItem(x.url, `Your reason helped: ${x.title}`, `+${x.points} ⚡`)).join("");
  return {
    subject,
    preheader: called ? `You called ${called} of them.` : "See how it turned out.",
    body: `${h1(o.outcomes.length ? "How it turned out" : "Your reason helped")}${outcomeHtml}${helpfulHtml}`,
    text: [...o.outcomes.map((x) => `${x.title}: ${x.poster} picked ${x.picked ?? "neither"}${x.calledIt ? " — you called it!" : ""} ${x.url}`), ...o.helpful.map((x) => `Your reason helped: ${x.title} (+${x.points}) ${x.url}`)].join("\n"),
  };
}

// ---------------- Getting started & coming back ----------------

export function welcome(o: { name: string; voteUrl: string; postUrl: string; loopPoints: number }): Built {
  return {
    subject: "Welcome to crowdpick",
    preheader: "Your guest votes are saved. Here's how it works.",
    body: `${h1(`Welcome, ${esc(o.name)}`)}${p("Here's how crowdpick works:")}
${p("1. <b>Post two options</b> — photos, links or just names.<br>2. <b>Get votes fast</b> — from friends and people like you.<br>3. <b>Close the loop</b> — say what you picked and how it went.")}
${p(`Voting earns ⚡ points, and closing the loop earns +${o.loopPoints}. More points = your next question reaches voters sooner. Any guest votes you cast are already saved to your account.`, true)}
${btn(o.postUrl, "Post your first battle")}${btn(o.voteUrl, "Start voting", A)}`,
    text: `Welcome to crowdpick, ${o.name}!\nPost a battle: ${o.postUrl}\nStart voting: ${o.voteUrl}`,
  };
}

export function firstBattleNudge(o: { postUrl: string; examples: { title: string; url: string }[] }): Built {
  return {
    subject: "Stuck between two? Ask the crowd",
    preheader: "It takes 30 seconds to post.",
    body: `${h1("Stuck between two?")}${p("Here's what people like you are deciding right now:")}
${o.examples.map((x) => listItem(x.url, x.title)).join("")}<div style="height:10px"></div>${btn(o.postUrl, "Post your own")}`,
    text: `Stuck between two? Post a battle in 30 seconds: ${o.postUrl}`,
  };
}

export function tierUp(o: { tier: string; postUrl: string }): Built {
  return {
    subject: `You're now ${o.tier} priority ⚡`,
    preheader: "Your next battle reaches more voters, sooner.",
    body: `${h1(`You're now ${esc(o.tier)} priority`)}${p("Thanks for helping others decide. Your next battle will be shown to more voters, sooner.")}${btn(o.postUrl, "Post a battle")}`,
    text: `You're now ${o.tier} priority. Post a battle: ${o.postUrl}`,
  };
}

export function weekly(o: {
  battles: { title: string; url: string; sub: string }[];
  outcomes: { title: string; url: string; sub: string }[];
  points: number;
  tierLine: string;
  voteUrl: string;
}): Built {
  const n = o.battles.length;
  return {
    subject: n ? `${n} decision${n > 1 ? "s" : ""} need${n > 1 ? "" : "s"} you this week` : "How your picks turned out this week",
    preheader: o.outcomes.length ? "Plus how your past picks turned out." : o.tierLine,
    body: `${h1("Your week on crowdpick")}
${n ? `<p style="font-size:13px;color:${MUTED};margin:16px 0 0;text-transform:uppercase;letter-spacing:.04em">Picked for you</p>${o.battles.map((x) => listItem(x.url, x.title, x.sub)).join("")}` : ""}
${o.outcomes.length ? `<p style="font-size:13px;color:${MUTED};margin:16px 0 0;text-transform:uppercase;letter-spacing:.04em">How your picks turned out</p>${o.outcomes.map((x) => listItem(x.url, x.title, x.sub)).join("")}` : ""}
<p style="font-size:15px;margin:16px 0">⚡ <b>${o.points}</b> · ${esc(o.tierLine)}</p>${btn(o.voteUrl, "Start voting")}`,
    text: `Your week on crowdpick\n${o.battles.map((x) => `- ${x.title} ${x.url}`).join("\n")}\n${o.outcomes.map((x) => `- ${x.title}: ${x.sub} ${x.url}`).join("\n")}\nVote: ${o.voteUrl}`,
  };
}

// ---------------- Messages ----------------

export function dmRequest(o: { name: string; url: string }): Built {
  return {
    subject: `${o.name} wants to send you a message`,
    preheader: "They follow you. Accept it to read it — or ignore it.",
    body: `${h1(`${esc(o.name)} wants to send you a message`)}${p("They follow you on crowdpick. You'll see the message only if you accept the request, and they won't be told if you don't.", true)}${btn(o.url, "See the request")}`,
    text: `${o.name}, who follows you, wants to send you a message: ${o.url}`,
  };
}
