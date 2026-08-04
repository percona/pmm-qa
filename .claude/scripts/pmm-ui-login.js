#!/usr/bin/env node
// Log into PMM UI with the pre-installed Chromium, bypassing the Grafana
// login form and self-signed TLS issues on a freshly provisioned box.
//
// Usage:
//   PMM_URL='https://<linode-ip>'  node pmm-ui-login.js PMM-14576
//   ADMIN_PASSWORD='pmm3admin!'    (optional, this is the default)
//
// Writes a reusable Playwright storage state to
// .claude/scripts/.sessions/<SESSION_ID>.json — pass that file to a
// screenshot/interaction script via `storageState` to skip logging in again.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error("usage: node pmm-ui-login.js <SESSION_ID>  e.g. PMM-14576");
    process.exit(1);
  }

  const pmmUrl = process.env.PMM_URL || "https://127.0.0.1";
  const adminPassword = process.env.ADMIN_PASSWORD || "pmm3admin!";
  const headed = process.env.PMM_UI_HEADED !== "0";
  const width = Number(process.env.PMM_UI_WIDTH || 1920);
  const height = Number(process.env.PMM_UI_HEIGHT || 1200);

  const sessionsDir = path.join(__dirname, ".sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  const storageStatePath = path.join(sessionsDir, `${sessionId}.json`);

  const authToken = Buffer.from(`admin:${adminPassword}`).toString("base64");

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height },
  });
  const page = await context.newPage();

  await page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
  await page.route("**/api/user/auth-tokens/rotate", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/v1/users/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        alerting_tour_completed: true,
        product_tour_completed: true,
        snoozed_pmm_version: "",
        user_id: 1,
      }),
    }),
  );
  await page.route("**/v1/server/updates?force=**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        installed: {},
        last_check: new Date().toISOString(),
        latest: {},
        update_available: false,
      }),
    }),
  );

  await page.goto(pmmUrl);
  const base = new URL(page.url()).origin;

  const res = await page.request.post(`${base}/graph/login`, {
    data: { user: "admin", password: adminPassword },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: HTTP ${res.status()} ${await res.text()}`);
  }
  await page.goto(`${base}/pmm-ui/help`);

  await context.storageState({ path: storageStatePath });
  await browser.close();

  console.log(
    `PMM UI login OK (session=${sessionId}, url=${pmmUrl}, storageState=${storageStatePath})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
