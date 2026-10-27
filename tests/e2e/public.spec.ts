import { expect, test } from "@playwright/test";

test("home page renders and switches to Tamil", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kongu");
  await page.getByRole("button", { name: "தமிழ்" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("கொங்கு");
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("public pages load without horizontal overflow", async ({ page }) => {
  for (const path of ["/about", "/how-it-works", "/membership", "/faq", "/contact", "/safety", "/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${path} overflows horizontally`).toBe(false);
  }
});

test("member areas redirect anonymous visitors to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("home page has no console errors (e.g. CSP violations)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
