import { test, expect, chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE        = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const AUTH_DIR    = path.join(__dirname, ".auth");
const ADMIN_JSON  = path.join(AUTH_DIR, "admin.json");
const PATIENT_JSON = path.join(AUTH_DIR, "patient.json");

async function ensureAuth(jsonPath: string, emailEnv: string, passEnv: string): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  if (fs.existsSync(jsonPath)) return;
  const email    = process.env[emailEnv];
  const password = process.env[passEnv];
  if (!email || !password) {
    fs.writeFileSync(jsonPath, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();
  await page.goto(`${BASE}/auth/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 15_000 });
  await context.storageState({ path: jsonPath });
  await browser.close();
}

test.describe("Staff portal — admin", () => {
  test.beforeAll(async () => { await ensureAuth(ADMIN_JSON, "E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"); });
  test.use({ storageState: ADMIN_JSON });

  test("dashboard loads", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/today|appointment|session/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("booking page shows patient search", async ({ page }) => {
    await page.goto(`${BASE}/dashboard/booking`);
    await expect(page.getByPlaceholder(/search patient/i)).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Patient portal", () => {
  test.beforeAll(async () => { await ensureAuth(PATIENT_JSON, "E2E_PATIENT_EMAIL", "E2E_PATIENT_PASSWORD"); });
  test.use({ storageState: PATIENT_JSON });

  test("patient dashboard loads", async ({ page }) => {
    await page.goto(`${BASE}/patient/dashboard`);
    await expect(page).toHaveURL(/patient\/dashboard/);
  });

  test("patient cannot access staff dashboard", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/patient/);
  });
});