/**
 * e2e/global-setup.js  (CommonJS — required by Playwright's require() loader)
 *
 * Logs in as admin and patient once before the test suite runs, and saves
 * authenticated browser storage states so individual spec files skip login.
 *
 * WHY .js and not .ts:
 *   Playwright loads globalSetup with Node's require(), NOT its own TS
 *   transpiler. Raw .ts files cannot be require()'d, so we keep this file
 *   as plain CJS JavaScript. The spec files (*.spec.ts) are handled by
 *   Playwright's built-in transpiler and remain TypeScript.
 *
 * CREDENTIALS — set in .env.test (gitignored):
 *   E2E_ADMIN_EMAIL       E2E_ADMIN_PASSWORD
 *   E2E_PATIENT_EMAIL     E2E_PATIENT_PASSWORD
 *   PLAYWRIGHT_BASE_URL   (default: http://localhost:3000)
 *
 * These should point at seeded test accounts (see prisma/seed.ts).
 */

"use strict";

const { chromium } = require("@playwright/test");
const fs   = require("fs");
const path = require("path");

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function loginAs(email, password, storageStatePath) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(
    (url) => !url.pathname.includes("/auth/login"),
    { timeout: 15_000 }
  );

  await context.storageState({ path: storageStatePath });
  await browser.close();
}

function writeEmptyState(filePath) {
  fs.writeFileSync(filePath, JSON.stringify({ cookies: [], origins: [] }));
}

async function globalSetup() {
  const authDir = path.join(__dirname, ".auth");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const adminPath   = path.join(authDir, "admin.json");
  const patientPath = path.join(authDir, "patient.json");

  const adminEmail    = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const patientEmail  = process.env.E2E_PATIENT_EMAIL;
  const patientPass   = process.env.E2E_PATIENT_PASSWORD;

  if (adminEmail && adminPassword) {
    console.log("[E2E] Logging in as admin…");
    await loginAs(adminEmail, adminPassword, adminPath);
    console.log("[E2E] Admin auth state saved.");
  } else {
    console.warn("[E2E] E2E_ADMIN_EMAIL/PASSWORD not set — skipping admin login.");
    writeEmptyState(adminPath);
  }

  if (patientEmail && patientPass) {
    console.log("[E2E] Logging in as patient…");
    await loginAs(patientEmail, patientPass, patientPath);
    console.log("[E2E] Patient auth state saved.");
  } else {
    console.warn("[E2E] E2E_PATIENT_EMAIL/PASSWORD not set — skipping patient login.");
    writeEmptyState(patientPath);
  }
}

module.exports = globalSetup;
