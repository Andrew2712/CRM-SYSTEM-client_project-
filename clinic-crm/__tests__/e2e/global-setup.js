"use strict";

const { chromium } = require("@playwright/test");
const fs   = require("fs");
const path = require("path");

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

async function loginAs(browser, email, password, storageStatePath) {
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
  await context.close();
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

  const browser = await chromium.launch({ args: BROWSER_ARGS });

  try {
    if (adminEmail && adminPassword) {
      console.log("[E2E] Logging in as admin…");
      await loginAs(browser, adminEmail, adminPassword, adminPath);
      console.log("[E2E] Admin auth state saved.");
    } else {
      console.warn("[E2E] E2E_ADMIN_EMAIL/PASSWORD not set — skipping admin login.");
      writeEmptyState(adminPath);
    }

    if (patientEmail && patientPass) {
      console.log("[E2E] Logging in as patient…");
      await loginAs(browser, patientEmail, patientPass, patientPath);
      console.log("[E2E] Patient auth state saved.");
    } else {
      console.warn("[E2E] E2E_PATIENT_EMAIL/PASSWORD not set — skipping patient login.");
      writeEmptyState(patientPath);
    }
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;