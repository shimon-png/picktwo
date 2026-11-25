import { createHmac } from "node:crypto";
import { test, expect, devices, type Page, type Browser } from "@playwright/test";
import { pickArm, type GateArm } from "../../src/server/services/gate-test-rules";
import { ECONOMY_DEFAULTS } from "../../src/lib/constants";
import { inHoldout } from "../../src/server/services/ranking";

/** Free votes before the sign-up gate, and group B's dialog repeat (default config). */
const FREE = ECONOMY_DEFAULTS.guestVoteLimit;
const EVERY = ECONOMY_DEFAULTS.softGateEvery;

/** Casts `n` new votes through the API as this page's visitor (refetching the feed as it runs out); returns the responses. */
async function apiVotes(page: Page, n: number) {
  const out: { slug: string; status: number; body: { softGate?: boolean; gatePrompt?: boolean } | null }[] = [];
  while (out.length < n) {
    const items = (await page.request.get("/api/feed?limit=20").then((r) => r.json())).items as { slug: string }[];
    const fresh = items.filter((it) => !out.some((o) => o.slug === it.slug));
    if (!fresh.length) break;
    for (const it of fresh.slice(0, n - out.length)) {
      const r = await page.request.post(`/api/battles/${it.slug}/vote`, { data: { side: "A" } });
      out.push({ slug: it.slug, status: r.status(), body: r.ok() ? await r.json() : null });
      if (!r.ok()) return out;
    }
  }
  return out;
}

// Requires DEV_LOGIN=true and no AUTH_RESEND_KEY on the server, so the sign-in code is shown on screen.
const stamp = Date.now().toString(36);

/**
 * A fresh signed-out browser pinned to a sign-up gate test group: its device cookie is chosen so the (deterministic)
 * assignment lands in `arm`. Assumes the default gateTestPct of 50.
 */
let guests = 0;
const salt = Math.random().toString(36).slice(2, 8);
async function guestIn(browser: Browser, baseURL: string | undefined, arm: GateArm) {
  const n = ++guests; // a new browser every call
  let id = "";
  // …and outside the about-you cards holdout, so the deck asks its questions.
  // …and outside the about-you cards and profile bar holdouts, so the deck asks its questions and shows the bar.
  for (
    let i = 0;
    !id || pickArm(id, 50) !== arm || inHoldout(`about:${id}`, ECONOMY_DEFAULTS.aboutHoldoutPct) || inHoldout(`pbar:${id}`, ECONOMY_DEFAULTS.profileBarHoldoutPct);
    i++
  )
    id = `d_e2e${stamp}${salt}${arm}${n}x${i}`;
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "pt_vid", value: id, url: baseURL ?? "http://localhost:3000" }]);
  await ctx.addInitScript(() => localStorage.setItem("cp_tour_v1", "seen"));
  return ctx;
}

async function login(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  const hint = await page.getByText(/Dev mode: your code is \d{6}/).textContent();
  await page.getByLabel("Code").fill(hint!.match(/\d{6}/)![0]);
  await page.getByRole("button", { name: "Verify" }).click();
  // New accounts continue to the username step; the tests finish setup on /onboarding instead.
  await expect(page.getByLabel(/Pick a username/)).toBeVisible();
}

async function onboard(page: Page, handle: string) {
  if (!page.url().includes("/onboarding")) await page.goto("/onboarding");
  await page.getByLabel("Display name").fill(handle);
  await page.getByLabel("Username").fill(handle);
  await page.getByLabel("ZIP code").fill("10001");
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByRole("button", { name: "25–34" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "5–8" }).click();
  await page.getByText("I’m 18 or older").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Got it — let’s go" }).click();
}

async function newUser(browser: Browser, name: string) {
  const ctx = await browser.newContext();
  // Skip the first-visit tutorial overlay on /vote; it would block taps.
  await ctx.addInitScript(() => localStorage.setItem("cp_tour_v1", "seen"));
  const page = await ctx.newPage();
  await login(page, `${name}-${stamp}@test.dev`);
  await onboard(page, `${name}_${stamp}`.slice(0, 20));
  return page;
}

const SHOTS = process.env.E2E_SHOTS;
async function snap(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test("post → vote (anon + signed in) → close the loop → called it", async ({ browser }) => {
  // Poster creates a battle: options first, then the review sheet
  const poster = await newUser(browser, "poster");
  await poster.goto("/post");
  await expect(poster.getByRole("button", { name: "Continue" })).toBeDisabled();
  await poster.getByRole("button", { name: "Name for option A" }).click();
  await poster.getByLabel("Name of option A").fill("Lego Art Set");
  await poster.getByLabel("Name of option B").fill("Paint easel");
  await snap(poster, "01-new-battle");
  await poster.getByRole("button", { name: "Continue" }).click();
  const sheet = poster.getByRole("dialog", { name: "Review & publish" });
  await expect(sheet.getByLabel("Question")).toHaveValue("Lego Art Set or Paint easel?");
  await expect(sheet.getByText(/Category/)).toHaveCount(0);
  await expect(sheet.getByLabel(/Post as/)).toHaveCount(0); // admin-only
  await sheet.getByLabel("Question").fill(`Gift for my 6 y/o ${stamp}`);
  await sheet.getByLabel(/Context/).fill("Loves art, budget ~$50");
  await expect(sheet.getByText(/Kid’s age/)).toHaveCount(0);
  await expect(sheet.getByRole("checkbox")).toHaveCount(0); // data use lives in Settings now
  await sheet.getByRole("button", { name: /Target a specific group/ }).click();
  await sheet.getByRole("button", { name: "Parents", exact: true }).click();
  await sheet.getByRole("button", { name: "5–8" }).click();
  await sheet.getByRole("button", { name: "1 hour" }).click();
  await snap(poster, "02-review");
  await sheet.getByRole("button", { name: "Publish & share" }).click();
  await poster.waitForURL(/\/b\/[A-Za-z0-9]{8}\/published/);
  await expect(poster.getByRole("heading", { name: "Your battle is live" })).toBeVisible();
  await expect(poster.getByText("Get answered faster")).toBeVisible();
  await snap(poster, "03-published");
  await poster.getByRole("link", { name: "View my battle" }).click();
  await poster.waitForURL(/\/b\/[A-Za-z0-9]{8}$/);
  const url = poster.url().split("?")[0];
  await expect(poster.getByRole("link", { name: /priority points/ })).toBeVisible(); // ⚡ pill

  // Anonymous voter: results hidden until vote, then shown (A-4, A-6)
  const anonCtx = await browser.newContext();
  const anon = await anonCtx.newPage();
  await anon.goto(url);
  await expect(anon.getByText("Tap to vote")).toBeVisible();
  await anon.waitForTimeout(1600);
  await anon.getByRole("button", { name: "Vote for Lego Art Set" }).click();
  await expect(anon.getByText(/1\s*vote/)).toBeVisible();
  await anon.reload();
  await expect(anon.getByRole("button", { name: "Vote for Lego Art Set" })).toHaveAttribute("aria-pressed", "true");

  // Two signed-in voters earn points (quality vote + reason)
  const v1 = await newUser(browser, "voter1");
  await v1.goto(url);
  await v1.waitForTimeout(1700);
  await v1.getByRole("button", { name: "Vote for Lego Art Set" }).click();
  await expect(v1.getByText(/thanks for helping/)).toBeVisible();
  await v1.getByLabel("Reason for your vote").fill("Building plus art is the best combo");
  await v1.getByRole("button", { name: "Add" }).click();
  await expect(v1.getByText(/for adding a reason/)).toBeVisible();

  const v2 = await newUser(browser, "voter2");
  await v2.goto(url);
  await v2.waitForTimeout(1700);
  await v2.getByRole("button", { name: "Vote for Paint easel" }).click();
  // A typed reason earns the reason bonus (no suggested chips since Nov 25)
  await v2.getByLabel("Reason for your vote").fill("She paints every single day already");
  await v2.getByRole("button", { name: "Add" }).click();
  await expect(v2.getByText(/for adding a reason/)).toBeVisible();
  await expect(v2.getByText(/3\s*votes/)).toBeVisible();

  // Owner results: relevance line, top reasons, sticky close-the-loop
  await poster.reload();
  await expect(poster.getByText(/3 votes · \d+ from parents of 5–8 year olds/)).toBeVisible();
  await expect(poster.getByText("Top reasons")).toBeVisible();
  await snap(poster, "04-results");
  await poster.getByRole("link", { name: /Decided\? Close the loop/ }).click();
  await poster.waitForURL(url + "/report");

  // Close the loop
  await expect(poster.getByText(/Voters said Lego Art Set · 67% of 3 votes/)).toBeVisible();
  await poster.getByRole("button", { name: "Picked Lego Art Set" }).click();
  await poster.getByRole("button", { name: /Went well/ }).click();
  await poster.getByLabel(/Anything to add/).fill("She played with it all weekend long!");
  await snap(poster, "05-close-loop");
  await poster.getByRole("button", { name: /Share the outcome/ }).click();
  await expect(poster.getByText(/Loop closed — thank you/)).toBeVisible();
  await poster.waitForURL(/\/you$/);
  await expect(poster.getByText(/Closed · picked Lego Art Set/)).toBeVisible();
  // Ledger shows the reward
  await expect(poster.getByText(/^Closed the loop/)).toBeVisible();
  await expect(poster.getByText("Closed within 48h")).toBeVisible();
  await snap(poster, "06-you");
  await poster.goto(url);
  await expect(poster.getByText("Loop closed", { exact: true })).toBeVisible();

  // Voter 1 called it
  await v1.goto("/activity");
  // The notification (Updates starts open) …
  await expect(v1.getByRole("link", { name: /You called it/ })).toBeVisible();
  // … and the Votes history shows the battle with the voter's pick.
  await v1.getByText("Votes", { exact: true }).click();
  await expect(v1.getByText(/You picked/).first()).toBeVisible();
  await v1.goto("/you");
  await expect(v1.getByText("Called it!")).toBeVisible();
});

test("vote stack: tap to vote, scores, auto-advance, skip", async ({ browser }) => {
  const p = await newUser(browser, "swiper");
  await p.goto("/vote");
  const card = p.locator("main article").first();
  const title1 = await card.getAttribute("aria-label");
  await snap(p, "07-vote-stack");
  await p.waitForTimeout(1600);
  await p.getByRole("button", { name: /^Vote for/ }).first().click();
  await expect(card.getByText(/\d+%/).first()).toBeVisible();
  await snap(p, "08-vote-voted");
  // The next battle comes up by itself after the scores show.
  await expect.poll(() => p.locator("main article").first().getAttribute("aria-label"), { timeout: 5000 }).not.toEqual(title1);
  const title2 = await p.locator("main article").first().getAttribute("aria-label");
  await p.getByRole("button", { name: "Skip" }).click();
  await p.waitForTimeout(500);
  expect(await p.locator("main article").first().getAttribute("aria-label")).not.toEqual(title2);
});

test("homepage: anonymous one-tap vote", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto("/");
  await expect(p.getByText("Ask people like you.")).toBeVisible();
  await expect(p.getByText("Tap one to vote · no account needed")).toBeVisible();
  await snap(p, "09-home");
  await p.waitForTimeout(1600);
  await p.getByRole("button", { name: /^Vote for/ }).first().click();
  await expect(p.getByText(/Counted\. \d+ (people|person) weighed in/)).toBeVisible();
});

test("homepage hero: votes count toward the free votes, then sign-up (Alex, Nov 24)", async ({ browser, baseURL }) => {
  const ctx = await guestIn(browser, baseURL, "control");
  const p = await ctx.newPage();
  await p.goto("/vote");
  // Use most of the free votes elsewhere, then the last two on the homepage hero.
  const used = await apiVotes(p, FREE - 2);
  test.skip(used.length < FREE - 2, "not enough open battles");
  await p.goto("/");
  const hero = p.locator('[data-track="hero_card"]');
  const seen = new Set<string>();
  for (let i = 0; i < 2; i++) {
    const title = (await hero.locator("h2").first().innerText()).trim();
    expect(seen.has(title)).toBe(false); // no repeats
    seen.add(title);
    await hero.getByRole("button", { name: /^Vote for/ }).first().click();
    await expect(hero.getByText(/Counted\. \d+ (people|person) weighed in/)).toBeVisible();
    await expect(hero.locator("h2").first()).not.toHaveText(title, { timeout: 8000 });
  }
  await hero.getByRole("button", { name: /^Vote for/ }).first().click();
  await expect(p.getByRole("dialog", { name: "Sign up to keep voting" })).toBeVisible();
});

test("sign-up gate test, group B: a closable dialog after the free votes and every few after, never blocked", async ({ browser, baseURL }) => {
  const ctx = await guestIn(browser, baseURL, "soft");
  const page = await ctx.newPage();
  await page.goto("/vote");
  const n = FREE + EVERY + 1;
  const votes = await apiVotes(page, n);
  test.skip(votes.length < n, "not enough open battles");
  for (const v of votes) {
    expect(v.status).toBe(200); // never the 401 wall
    expect(v.body?.softGate).toBe(true);
  }
  expect(votes.flatMap((v, i) => (v.body?.gatePrompt ? [i + 1] : []))).toEqual([FREE, FREE + EVERY]);
  // In the deck: past the free votes there's no wall; the next prompt vote opens the closable dialog.
  await page.reload();
  await expect(page.getByRole("region", { name: "Sign up to keep voting" })).toHaveCount(0);
  const more = await apiVotes(page, EVERY - 2);
  test.skip(more.length < EVERY - 2, "not enough open battles");
  await page.reload();
  await expect(page.getByText("Keep voting, or sign up to save your picks.")).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: /^Vote for/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Sign up, or keep voting" })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Not now, keep voting" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("profile bar: counts deck votes, explains itself, asks a missing question (Pickbot Phase 0)", async ({ browser, baseURL }) => {
  const ctx = await guestIn(browser, baseURL, "control");
  const p = await ctx.newPage();
  await p.goto("/vote");
  const bar = p.getByTestId("profile-bar");
  await expect(bar.getByText("Profile 0/30")).toBeVisible();
  await expect(bar.getByText("+4 about you")).toBeVisible();
  await p.getByRole("button", { name: /^Vote for/ }).first().click();
  await expect(bar.getByText("Profile 1/30")).toBeVisible();
  await bar.getByRole("button", { name: /Profile 1\/30/ }).click();
  await expect(bar.getByText("29 more battles to your full profile")).toBeVisible();
  await expect(bar.getByText("A complete profile unlocks")).toBeVisible();
  await snap(p, "profile-bar-open");
  await bar.getByRole("button", { name: "Answer" }).first().click();
  const card = p.getByRole("article", { name: /About you: I'm a…/ });
  await card.getByRole("button", { name: "Woman" }).click();
  await expect(card).toBeHidden();
  await expect(bar.getByText("+3 about you")).toBeVisible();
  await snap(p, "profile-bar");
  await ctx.close();
});

test("about-you cards: a question after vote 2, answers stick, skip works (Nov 25)", async ({ browser, baseURL }) => {
  const ctx = await guestIn(browser, baseURL, "control");
  const page = await ctx.newPage();
  await page.goto("/vote");
  const pickOne = async () => {
    const title = (await page.locator("article.deck-card h1").first().innerText()).trim();
    await expect(async () => {
      await page.getByRole("button", { name: /^Vote for/ }).first().click();
      await expect(page.locator("article.deck-card h1").first()).not.toHaveText(title, { timeout: 4000 });
    }).toPass({ timeout: 20_000 });
  };
  await pickOne();
  await pickOne();
  const card = page.getByRole("article", { name: /About you/ });
  await expect(card.getByText("I'm a…")).toBeVisible();
  await card.getByRole("button", { name: "Woman" }).click();
  await expect(card).toHaveCount(0);
  await pickOne();
  await pickOne();
  await expect(card.getByRole("button", { name: "25–34" })).toBeVisible(); // six equal slices, shuffled
  await expect(card.getByRole("button")).toHaveCount(7); // 6 answers + Skip
  await card.getByRole("button", { name: "Skip" }).click();
  await expect(card).toHaveCount(0);
  const me = await page.request.get("/api/signup-prefill").then((r) => r.json());
  expect(me).toMatchObject({ sex: "FEMALE", ageRange: null });
});

test("non-admin cannot post as another user", async ({ browser }) => {
  const p = await newUser(browser, "notadmin");
  const res = await p.request.post("/api/battles", {
    data: { title: "Red or blue?", deadlineHours: 24, options: [{ label: "Red" }, { label: "Blue" }], postAs: "someone_else" },
  });
  expect(res.status()).toBe(403);
});

test("non-admin gets 404 on /admin (A-20)", async ({ browser }) => {
  const p = await newUser(browser, "nonadmin");
  const res = await p.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("contact form: terms link → form → thank-you", async ({ page }) => {
  await page.goto("/legal/terms");
  await page.getByRole("link", { name: "Contact the crowdpick.ai team" }).click();
  await page.waitForURL("**/contact");
  await page.getByLabel("Email").fill(`contact-${stamp}@test.dev`);
  await page.getByLabel("Message").fill("Testing the contact form end to end.");
  await page.waitForTimeout(2600); // the form ignores submits faster than a human could type
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Thanks, we got your message")).toBeVisible();
});

test("guest gate: free votes, then sign up with an emailed code (needs DEV_LOGIN, no Resend key)", async ({ browser, baseURL }) => {
  const ctx = await guestIn(browser, baseURL, "control");
  const page = await ctx.newPage();
  await page.goto("/vote");
  const votes = await apiVotes(page, FREE + 1);
  test.skip(votes.length < FREE + 1, "not enough open battles");
  expect(votes.slice(0, FREE).every((v) => v.status === 200)).toBe(true);
  expect(votes[FREE].status).toBe(401); // one past the free votes: the wall
  // About-you answers given as a guest prefill the one-tap sign-up card and land on the account.
  for (const [question, answer] of [["sex", "FEMALE"], ["age", "AGE_35_44"]])
    expect((await page.request.post("/api/me/about", { data: { question, answer } })).ok()).toBe(true);
  await page.reload();
  const gate = page.getByRole("region", { name: "Sign up to keep voting" });
  await expect(gate.getByText("You’re all set. Just confirm.")).toBeVisible();
  await expect(gate.getByText(`Save your ${FREE} picks`)).toBeVisible();
  await expect(gate.getByText("Woman · 35–44")).toBeVisible();
  await gate.getByLabel("Your email").fill(`gate-${stamp}@test.dev`);
  await expect(gate.getByText(`@gate`)).toBeVisible(); // username follows the email
  await gate.getByRole("button", { name: "Email me a code" }).click();
  const code = (await gate.getByText(/Dev mode: your code is/).innerText()).match(/\d{6}/)![0];
  await gate.getByLabel("Code").fill(code);
  await gate.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL(/\/vote/);
  await expect(page.getByText(/to High priority|Top priority/)).toBeVisible();
  const me = await page.request.get("/api/me/quick-profile").then((r) => r.json());
  expect(me).toMatchObject({ complete: true, sex: "FEMALE", ageRange: "AGE_35_44" });
  // Guest votes carried over: none of the voted battles come back.
  const after = (await page.request.get("/api/feed").then((r) => r.json())).items as { slug: string }[];
  const votedSlugs = new Set(votes.slice(0, FREE).map((v) => v.slug));
  expect(after.some((a) => votedSlugs.has(a.slug))).toBe(false);
});

test("vote stack: a pick is final and the other photo steps aside", async ({ browser }) => {
  const page = await newUser(browser, "changer");
  await page.goto("/vote");
  const [a, b] = await page.getByRole("button", { name: /^Vote for/ }).all();
  await a.click();
  await expect(a).toHaveAttribute("aria-pressed", "true");
  await expect(b).toHaveCSS("opacity", "0");
});

test("profile setup prefills the username from the email: name + 4 digits, 'user' for a too-short name", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, `a@${stamp}.dev`);
  await page.goto("/onboarding");
  await expect(page.getByLabel("Username")).toHaveValue(/^user\d{4}$/);
});

test("voted like you + taste twins + direct messages (policy, block, opt-out)", async ({ browser }) => {
  const a = await newUser(browser, "twin_a");
  const b = await newUser(browser, "twin_b");
  const c = await newUser(browser, "twin_c");
  const handle = (n: string) => `${n}_${stamp}`.slice(0, 20);

  // A and B pick the same side on 3 battles; C picks the other side.
  const feed = await (await a.request.get("/api/feed")).json();
  const slugs: string[] = feed.items.slice(0, 3).map((i: { slug: string }) => i.slug);
  expect(slugs.length).toBe(3);
  for (const slug of slugs) {
    for (const [p, side] of [[a, "A"], [b, "A"], [c, "B"]] as const) {
      const r = await p.request.post(`/api/battles/${slug}/vote`, { data: { side, dwellMs: 4000, source: "feed" } });
      expect(r.ok()).toBeTruthy();
    }
  }

  // Taste twins: B ranks for A at 100%, C (always disagreed) at 0%, below B.
  await a.goto("/people-like-you");
  const row = (n: string) => a.getByRole("listitem").filter({ hasText: `@${handle(n)}` });
  await expect(row("twin_b")).toContainText("100% agree");
  await expect(row("twin_c")).toContainText("0% agree");
  await snap(a, "10-people-like-you");

  // Per battle: B is listed as voting like A; C is not.
  await a.goto(`/b/${slugs[0]}/like-you`);
  await expect(a.getByRole("link", { name: handle("twin_b"), exact: true })).toBeVisible();
  await expect(a.getByRole("link", { name: handle("twin_c"), exact: true })).toHaveCount(0);
  await snap(a, "11-like-you");

  // DMs: off by default, follow first, the first message is a request the receiver accepts.
  await a.goto(`/u/${handle("twin_b")}`);
  await expect(a.getByRole("link", { name: "Send DM", exact: true })).toHaveCount(0); // not following yet
  expect((await a.request.post("/api/messages", { data: { to: handle("twin_b"), body: "hi" } })).status()).toBe(403);
  // The profile streams in behind a loading skeleton, so a click can land before React hydrates and do nothing.
  // Click until the follow sticks (aria-pressed), then the server re-render shows "Send DM". The client-side
  // router.refresh() after a follow can race the streamed profile and keep the old render, so once the follow has
  // stuck, reload to get the server's answer instead of waiting on a refresh that already happened.
  await expect(async () => {
    const follow = a.getByRole("button", { name: /^Follow/ }).first();
    if ((await follow.getAttribute("aria-pressed")) !== "true") {
      await follow.click();
      await expect(follow).toHaveAttribute("aria-pressed", "true", { timeout: 4000 });
    } else {
      await a.reload();
    }
    await expect(a.getByRole("link", { name: "Send DM", exact: true })).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 30_000 });
  await a.getByRole("link", { name: "Send DM", exact: true }).click();
  await a.waitForURL(new RegExp(`/messages/${handle("twin_b")}`));
  // A's messages are off: round trip through Settings and back.
  await a.getByRole("link", { name: "Turn on messages" }).click();
  await a.waitForURL(/\/settings\?enable=chat/);
  await expect(a.getByRole("heading", { name: "Turn on messages to continue" })).toBeVisible();
  await a.getByRole("switch", { name: /Direct messages/ }).click();
  await a.waitForURL(new RegExp(`/messages/${handle("twin_b")}$`));
  await a.getByLabel(`Message @${handle("twin_b")}`).fill("Hey, we always agree!");
  await a.getByRole("button", { name: "Send" }).click();
  await expect(a.getByText(/Request sent\. You can send more once/)).toBeVisible({ timeout: 15_000 });
  await snap(a, "12-request-sent");

  // B gets the alert; messages are off, so B is asked first, then accepts the request.
  await b.goto("/vote");
  await expect(b.getByRole("link", { name: /Messages, 1 unread/ })).toBeVisible();
  await b.goto("/messages");
  await expect(b.getByText(/1 person who follows you wants/)).toBeVisible();
  await b.getByRole("link", { name: "Yes, turn on messages" }).click();
  await b.getByRole("switch", { name: /Direct messages/ }).click();
  await b.waitForURL(/\/messages$/);
  await b.getByRole("link", { name: new RegExp(handle("twin_a")) }).click();
  await expect(b.getByText(/who follows you, wants to send you a message/)).toBeVisible();
  await expect(b.getByText("Hey, we always agree!")).toHaveCount(0); // hidden until accepted
  await snap(b, "13-request-received");
  await b.getByRole("button", { name: "Accept" }).click();
  await expect(b.getByText("Hey, we always agree!")).toBeVisible();
  await b.getByLabel(`Message @${handle("twin_a")}`).fill("Ha, great minds");
  await b.getByRole("button", { name: "Send" }).click();
  await expect(b.getByLabel(`Message @${handle("twin_a")}`)).toHaveValue("", { timeout: 15_000 });
  await expect(a.getByText("Ha, great minds")).toBeVisible({ timeout: 12_000 }); // A's thread polls
  await snap(a, "14-chat");

  // C: A doesn't follow C, so no request can be sent.
  expect((await a.request.post("/api/messages", { data: { to: handle("twin_c"), body: "hi" } })).status()).toBe(403);

  // B blocks A from the conversation menu: A can no longer send, and they disappear from each other's lists.
  b.once("dialog", (d) => d.accept());
  await b.getByRole("button", { name: "Conversation options" }).click();
  await b.getByRole("menuitem", { name: /Block/ }).click();
  await b.waitForURL(/\/messages$/);
  await expect(b.getByRole("link", { name: new RegExp(handle("twin_a")) })).toHaveCount(0);
  expect((await a.request.post("/api/messages", { data: { to: handle("twin_b"), body: "still there?" } })).status()).toBe(403);
  await a.goto(`/b/${slugs[0]}/like-you`);
  await expect(a.getByRole("link", { name: handle("twin_b"), exact: true })).toHaveCount(0);
  // Unblock again from the thread.
  await b.goto(`/messages/${handle("twin_a")}`);
  await expect(b.getByText(/You blocked this person/)).toBeVisible();
  await b.getByRole("button", { name: "Conversation options" }).click();
  await b.getByRole("menuitem", { name: /Unblock/ }).click();
  await expect(b.getByLabel(`Message @${handle("twin_a")}`)).toBeVisible();

  // B hides from "Voted like you": A no longer sees B, and B can't see the lists either.
  await b.request.post("/api/me/profile", { data: { kind: "settings", showInVoteMatches: false } });
  await a.goto(`/b/${slugs[0]}/like-you`);
  await expect(a.getByRole("link", { name: handle("twin_b"), exact: true })).toHaveCount(0);
  await b.goto("/people-like-you");
  await expect(b.getByText(/You’re hidden from “Voted like you”/)).toBeVisible();
});

test("Pickbot: ask → profile question → tailored → quick battles → answer → anonymous crowd battle (fake AI)", async ({ browser }) => {
  // 10% of accounts are in the Pickbot holdout (stable per account): make a fresh one until it isn't.
  let p: Page | null = null;
  for (let i = 0; i < 4 && !p; i++) {
    const page = await newUser(browser, `asker${i}`);
    await page.goto("/ask");
    if (await page.getByLabel("Ask Pickbot").isVisible()) p = page;
  }
  test.skip(!p, "every account landed in the holdout");
  const page = p!;
  await expect(page.getByRole("link", { name: "Ask", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ask Pickbot" })).toBeVisible();
  await snap(page, "pickbot-01-ask");
  await page.getByLabel("Ask Pickbot").fill("Which dress for a winter wedding, the green or the burgundy?");
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForURL(/\/ask\/[^/]+$/);

  // Onboarding gave sex, age and ZIP: Pickbot asks only the missing relationship question.
  const gate = page.getByTestId("pickbot-gate");
  await expect(gate.getByText("of 4")).toBeVisible();
  await snap(page, "pickbot-02-gate");
  await gate.getByRole("button", { name: "Single" }).click();
  await expect(page.getByText("Single", { exact: true })).toBeVisible();

  // Under 30 battles: general or tailored.
  await page.getByRole("button", { name: /Tailored to my personality/ }).click();
  const battles = page.getByTestId("pickbot-battles");
  await expect(battles.getByText(/more to go/)).toBeVisible();
  await snap(page, "pickbot-03-battles");
  await battles.getByRole("button", { name: /^Vote for/ }).first().click();
  await expect(battles.getByText(/\d+%/).first()).toBeVisible();
  await page.getByRole("button", { name: "Stop and answer now" }).click();

  // The (fake) answer streams in, labelled General since the profile isn't complete.
  const answer = page.getByTestId("pickbot-answer").last();
  await expect(answer.getByText("The first option")).toBeVisible();
  await expect(answer.getByText("General")).toBeVisible();
  await expect(answer.getByText(/Why it fits you/)).toBeVisible();
  await answer.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(answer.getByRole("button", { name: "Helpful", exact: true })).toHaveAttribute("aria-pressed", "true");
  await snap(page, "pickbot-04-answer");

  // Ask the crowd: draft → review → post as "Asked via Pickbot".
  await page.getByRole("button", { name: "Yes, ask the crowd" }).click();
  const draft = page.getByTestId("pickbot-draft");
  await expect(draft.getByText("Anonymous · preview")).toBeVisible();
  await snap(page, "pickbot-05-draft");
  await draft.getByRole("button", { name: "Post anonymously" }).click();
  await expect(page.getByText("Posted anonymously.", { exact: false })).toBeVisible();
  await expect(page.getByText("With the crowd")).toBeVisible();
  await page.getByRole("link", { name: "See it →" }).click();
  await expect(page.getByText(/askedviapickbot|Asked via Pickbot/).first()).toBeVisible();
  await expect(page.getByText(/asker\d_/)).toHaveCount(0);

  // Follow-up in the same thread, and the question shows in history.
  await page.goBack();
  await page.getByLabel("Ask a follow-up").fill("What shoes go with it?");
  await page.getByLabel("Ask a follow-up").press("Enter");
  await expect(page.getByTestId("pickbot-answer")).toHaveCount(2);
  await page.goto("/ask");
  await expect(page.getByRole("heading", { name: "Your questions" })).toBeVisible();
});

test("Pickbot Plus: a signed Stripe webhook turns Plus on and off (no real Stripe)", async ({ browser }) => {
  const page = await newUser(browser, "plus");
  const me = await (await page.request.get("/api/me/export")).json();
  const userId = me.profile.id as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2e";
  const send = async (type: string, status: string) => {
    const body = JSON.stringify({ id: `evt_${Date.now()}`, type, data: { object: { customer: "cus_e2e", status, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, metadata: { userId } } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    return page.request.post("/api/stripe/webhook", { data: body, headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` } });
  };
  // A bad signature is refused.
  const bad = await page.request.post("/api/stripe/webhook", { data: "{}", headers: { "stripe-signature": "t=1,v1=00" } });
  expect(bad.status()).toBe(403);
  await page.goto("/plus");
  await expect(page.getByRole("heading", { name: "Pickbot Plus" })).toBeVisible();
  await expect(page.getByText(/You have Plus until/)).toHaveCount(0);
  expect((await send("customer.subscription.created", "active")).ok()).toBe(true);
  await page.reload();
  await expect(page.getByText(/You have Plus until/)).toBeVisible();
  await snap(page, "plus");
  expect((await send("customer.subscription.deleted", "canceled")).ok()).toBe(true);
  await page.reload();
  await expect(page.getByText(/You have Plus until/)).toHaveCount(0);
});

test("home screen: iPhone gets the Add to Home Screen steps on a later visit, and Not now snoozes it", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["iPhone 14"] });
  await ctx.addInitScript(() => localStorage.setItem("cp_tour_v1", "seen"));
  const p = await ctx.newPage();
  await login(p, `ios-${stamp}@test.dev`);
  await onboard(p, `ios_${stamp}`.slice(0, 20));
  await p.goto("/you");
  await expect(p.getByTestId("install-prompt")).toHaveCount(0); // first visit: not yet
  await p.evaluate(() => sessionStorage.clear()); // a new visit
  await p.goto("/you");
  const card = p.getByTestId("install-prompt");
  await expect(card.getByText("Add to Home Screen")).toBeVisible();
  await snap(p, "install-ios");
  await card.getByRole("button", { name: "Not now" }).click();
  await p.evaluate(() => sessionStorage.clear());
  await p.goto("/you");
  await expect(p.getByTestId("install-prompt")).toHaveCount(0);
  await ctx.close();
});
