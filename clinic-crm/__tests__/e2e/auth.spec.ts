import { test, expect, chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE       = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const AUTH_DIR   = path.join(__dirname, ".auth");
const ADMIN_JSON = path.join(AUTH_DIR, "admin.json");

function writeEmptyState(p: string): void {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify({ cookies: [], origins: [] }));
}

async function ensureAdminAuth(): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  if (fs.existsSync(ADMIN_JSON)) return;
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) { writeEmptyState(ADMIN_JSON); return; }
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();
  await page.goto(`${BASE}/auth/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 15_000 });
  await context.storageState({ path: ADMIN_JSON });
  await browser.close();
}

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => { await page.goto(`${BASE}/auth/login`); });

  test("renders the login form", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.getByLabel(/email/i).fill("notreal@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Unauthenticated redirects", () => {
  test("accessing /dashboard redirects to login", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/auth\/login/);
  });

  test("accessing /patient/dashboard redirects to login", async ({ page }) => {
    await page.goto(`${BASE}/patient/dashboard`);
    await expect(page).toHaveURL(/auth\/login/);
  });
});

test.describe("Authenticated admin", () => {
  test.beforeAll(async () => { await ensureAdminAuth(); });
  test.use({ storageState: ADMIN_JSON });

  test("can access staff dashboard", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page).not.toHaveURL(/auth\/login/);
  });
});