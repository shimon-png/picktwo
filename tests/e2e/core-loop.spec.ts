import { test, expect, type Page, type Browser } from "@playwright/test";

// Requires DEV_LOGIN=true on the server.
const stamp = Date.now().toString(36);

async function login(page: Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Demo email").fill(email);
  await page.getByRole("button", { name: "Sign in instantly" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"));
}

async function onboard(page: Page, handle: string) {
  if (!page.url().includes("/onboarding")) await page.goto("/onboarding");
  await page.getByLabel("Display name").fill(handle);
  await page.getByLabel("Username").fill(handle);
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "5–8" }).click();
  await page.getByText("I’m 18 or older").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Got it — let’s go" }).click();
}

async function newUser(browser: Browser, name: string) {
  const ctx = await browser.newContext();
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
  await expect(v1.getByText(/You called it/)).toBeVisible();
  await v1.goto("/you");
  await expect(v1.getByText("Called it!")).toBeVisible();
});

test("vote stack: tap to vote, reason chip, next, skip", async ({ browser }) => {
  const p = await newUser(browser, "swiper");
  await p.goto("/vote");
  const card = p.locator("main article").first();
  const title1 = await card.getAttribute("aria-label");
  await snap(p, "07-vote-stack");
  await p.waitForTimeout(1600);
  await p.getByRole("button", { name: /^Vote for/ }).first().click();
  await expect(card.getByText(/\d+%/).first()).toBeVisible();
  await expect(p.getByText(/Why\? optional/)).toBeVisible();
  await snap(p, "08-vote-voted");
  await p.getByRole("button", { name: /^Next/ }).click();
  await p.waitForTimeout(500);
  const title2 = await p.locator("main article").first().getAttribute("aria-label");
  expect(title2).not.toEqual(title1);
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
