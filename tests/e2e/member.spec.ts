import { expect, test } from "@playwright/test";

const SEEDED = { email: "arun.m0@example.invalid", password: process.env.SEED_MEMBER_PASSWORD ?? "Member@12345" };

test("registration rejects under-age and creates an account", async ({ page }) => {
  const year = new Date().getUTCFullYear();
  await page.goto("/register");
  await page.getByLabel("Email").fill(`e2e${Date.now()}@example.invalid`);
  await page.getByLabel("Password").fill("Password123");
  await page.getByLabel("Date of birth").fill(`${year - 19}-01-01`);
  await page.getByLabel("Gender").selectOption("MALE");
  await page.getByLabel(/I agree/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/at least 21 years/)).toBeVisible();

  await page.getByLabel("Date of birth").fill(`${year - 27}-01-01`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/verify your email/i)).toBeVisible();

  await page.getByRole("link", { name: "Create your profile" }).click();
  await page.getByLabel("Name to display").fill("E2E Tester");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page).toHaveURL(/\/profile\/edit\/career/);
});

test("member searches, views a profile and sends an interest; duplicate is prevented", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(SEEDED.email);
  await page.getByLabel("Password").fill(SEEDED.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/search?ageMin=21&ageMax=40");
  await expect(page.getByText(/profiles found/)).toBeVisible();
  await page.locator("article a").first().click();
  await expect(page).toHaveURL(/\/profiles\/KM\d+/);
  await expect(page.getByText("Contact details are shared after an interest is accepted.")).toBeVisible();

  await page.getByRole("button", { name: "Send interest" }).click();
  await expect(page.getByText("Interest sent").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Send interest" })).toHaveCount(0);

  // Members cannot reach the admin area.
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(403);
});
