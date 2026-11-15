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

test("post → vote (anon + signed in) → close the loop → called it", async ({ browser }) => {
  // Poster creates a battle
  const poster = await newUser(browser, "poster");
  await poster.goto("/post");
  await poster.getByRole("tab", { name: "Text" }).first().click();
  await poster.getByLabel("Name of option A").fill("Lego Art Set");
  await poster.getByLabel("Name of option B").fill("Paint easel");
  await poster.getByRole("button", { name: "Next" }).click();
  await poster.getByLabel("Your question").fill(`Gift for my 6 y/o ${stamp}`);
  await poster.getByLabel(/Context/).fill("Loves art, budget ~$50");
  await poster.getByRole("button", { name: "5–8" }).click();
  await poster.getByRole("button", { name: "1 hour" }).click();
  await poster.getByRole("button", { name: "Next" }).click();
  await poster.getByRole("button", { name: /Publish/ }).click();
  await poster.waitForURL(/\/b\/[A-Za-z0-9]{8}/);
  const url = poster.url().split("?")[0];
  await expect(poster.getByText(/Get votes fast/)).toBeVisible();
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
  await expect(v2.getByText(/3\s*votes/)).toBeVisible();

  // Poster closes the loop early (≥3 votes)
  await poster.goto(url.replace(/$/, "/report"));
  await poster.getByRole("button", { name: "Vote for Lego Art Set" }).click();
  await poster.getByRole("button", { name: /It worked out/ }).click();
  await poster.getByLabel(/Anything to add/).fill("She played with it all weekend long!");
  await poster.getByRole("button", { name: "Close the loop" }).click();
  await expect(poster.getByText(/Loop closed — thank you/)).toBeVisible();
  await poster.waitForURL(url);
  await expect(poster.getByText("Loop closed", { exact: true })).toBeVisible();

  // Poster's ledger shows the reward
  await poster.goto("/priority");
  await expect(poster.getByText("Closed the loop")).toBeVisible();
  await expect(poster.getByText("Closed within 48h")).toBeVisible();

  // Voter 1 called it
  await v1.goto("/activity");
  await expect(v1.getByText(/You called it/)).toBeVisible();
  await v1.goto("/priority");
  await expect(v1.getByText("Called it!")).toBeVisible();
});

test("swipe deck votes and skips", async ({ browser }) => {
  const p = await newUser(browser, "swiper");
  await p.goto("/vote");
  const title1 = await p.locator("main a.font-display").first().textContent();
  await p.waitForTimeout(1600);
  await p.getByRole("button", { name: /^Vote for/ }).first().click();
  await expect(p.getByText(/%/).first()).toBeVisible();
  await p.waitForTimeout(2000);
  const title2 = await p.locator("main a.font-display").first().textContent();
  expect(title2).not.toEqual(title1);
  await p.getByRole("button", { name: "Not for me" }).click();
  await p.waitForTimeout(600);
  expect(await p.locator("main a.font-display").first().textContent()).not.toEqual(title2);
});

test("non-admin gets 404 on /admin (A-20)", async ({ browser }) => {
  const p = await newUser(browser, "nonadmin");
  const res = await p.goto("/admin");
  expect(res?.status()).toBe(404);
});
