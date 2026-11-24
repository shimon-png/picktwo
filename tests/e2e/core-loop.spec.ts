import { test, expect, type Page, type Browser } from "@playwright/test";

// Requires DEV_LOGIN=true and no AUTH_RESEND_KEY on the server, so the sign-in code is shown on screen.
const stamp = Date.now().toString(36);

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
  // One-tap reason chip earns the reason bonus
  await v2.getByRole("button", { name: "Just feels right" }).click();
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

test("homepage hero: votes count toward the free votes, then sign-up (Alex, Nov 24)", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto("/");
  const hero = p.locator('[data-track="hero_card"]');
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
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

test("guest gate: 5 free votes, then sign up with an emailed code (needs DEV_LOGIN, no Resend key)", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => localStorage.setItem("cp_tour_v1", "seen"));
  const page = await ctx.newPage();
  await page.goto("/vote");
  const feed = (await page.request.get("/api/feed").then((r) => r.json())).items as { slug: string }[];
  test.skip(feed.length < 7, "needs at least 7 open battles");
  for (const it of feed.slice(0, 5)) expect((await page.request.post(`/api/battles/${it.slug}/vote`, { data: { side: "A" } })).ok()).toBe(true);
  const sixth = await page.request.post(`/api/battles/${feed[5].slug}/vote`, { data: { side: "A" } });
  expect(sixth.status()).toBe(401);
  await page.reload();
  const gate = page.getByRole("region", { name: "Sign up to keep voting" });
  await expect(gate.getByText("Step 1 of 4")).toBeVisible();
  await gate.getByLabel("Your email").fill(`gate-${stamp}@test.dev`);
  await gate.getByRole("button", { name: "Email me a code" }).click();
  const code = (await gate.getByText(/Dev mode: your code is/).innerText()).match(/\d{6}/)![0];
  await gate.getByLabel("Code").fill(code);
  await gate.getByRole("button", { name: "Verify" }).click();
  await expect(gate.getByText("Step 3 of 4")).toBeVisible();
  await gate.getByLabel(/Pick a username/).fill(`gate_${stamp}`.slice(0, 20));
  await gate.getByRole("button", { name: "Continue" }).click();
  await expect(gate.getByText("Step 4 of 4")).toBeVisible();
  await gate.getByRole("button", { name: "Female", exact: true }).click();
  await gate.getByRole("button", { name: "35–44" }).click();
  await gate.getByLabel(/ZIP code/).fill("94110");
  await gate.getByRole("button", { name: "Finish and keep voting" }).click();
  await page.waitForURL(/\/vote/);
  await expect(page.getByText(/to High priority|Top priority/)).toBeVisible();
  // Guest votes carried over: none of the 5 battles come back.
  const after = (await page.request.get("/api/feed").then((r) => r.json())).items as { slug: string }[];
  const votedSlugs = new Set(feed.slice(0, 5).map((f) => f.slug));
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
