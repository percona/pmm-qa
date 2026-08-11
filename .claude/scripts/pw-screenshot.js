#!/usr/bin/env node
// Generic one-off screenshot helper for QA evidence — replaces Cursor's
// `playwright-cli` with the pre-installed Chromium directly.
//
// Usage:
//   node pw-screenshot.js <url> <output.png> [sessionId]
//
// If <sessionId> is given and .claude/scripts/.sessions/<sessionId>.json
// exists (written by pmm-ui-login.js), it is reused as the browser context's
// storage state so PMM pages stay logged in.
//
// For github.com pages (e.g. an Actions run on a private repo) this reuses
// whatever browser session already exists — same caveat as before: if the
// repo is private and no GitHub session is loaded, the page renders blank
// and you must sign in interactively first.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { spkiPinFromCertFile } = require("./lib/spki-pin");
const { proxyLaunchOptions } = require("./lib/proxy");

async function main() {
  const [, , url, outputPath, sessionId] = process.argv;
  if (!url || !outputPath) {
    console.error(
      "usage: node pw-screenshot.js <url> <output.png> [sessionId]",
    );
    process.exit(1);
  }

  const width = Number(process.env.PMM_UI_WIDTH || 1920);
  const height = Number(process.env.PMM_UI_HEIGHT || 1080);

  // PMM_CERT_PATH (see pmm-ui-login.js) pins PMM's own cert instead of
  // trusting any cert -- optional since this script also screenshots
  // non-PMM pages (e.g. a GitHub Actions run) with a real CA already, which
  // strict verification (the default below) already handles fine.
  const certPath = process.env.PMM_CERT_PATH;
  const launchArgs = [];
  if (certPath) {
    if (!fs.existsSync(certPath)) {
      console.error(`PMM_CERT_PATH set but not found: ${certPath}`);
      process.exit(1);
    }
    launchArgs.push(`--ignore-certificate-errors-spki-list=${spkiPinFromCertFile(certPath)}`);
  }

  const contextOpts = { ignoreHTTPSErrors: false, viewport: { width, height } };
  if (sessionId) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sessionId)) {
      console.error(`invalid sessionId '${sessionId}' (letters, digits, '_', '-' only)`);
      process.exit(1);
    }
    const sessionsDir = path.join(__dirname, ".sessions");
    const storageStatePath = path.join(sessionsDir, `${sessionId}.json`);
    if (path.relative(sessionsDir, storageStatePath).startsWith("..")) {
      console.error(`invalid sessionId '${sessionId}': resolves outside .sessions/`);
      process.exit(1);
    }
    if (fs.existsSync(storageStatePath)) {
      contextOpts.storageState = storageStatePath;
    }
  }

  // Explicit executablePath: the pre-installed Chromium revision at
  // /opt/pw-browsers can drift from what a freshly `npm install`-ed
  // playwright expects (confirmed live), so don't rely on Playwright's own
  // bundled-browser resolution to find it.
  const proxyOpts = proxyLaunchOptions();
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: [...launchArgs, ...proxyOpts.args],
    proxy: proxyOpts.proxy,
  });
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  // Same stub pmm-ui-login.js installs: without it PMM pops an "Update to
  // PMM x.y.z" modal over the page, which lands in the middle of every
  // evidence screenshot. Never matches non-PMM URLs.
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

  await page.goto(url, { waitUntil: "networkidle" });

  // "networkidle" is not enough for Grafana: PMM serves an app shell that
  // reports idle while still showing "Loading Percona Monitoring and
  // Management", so a screenshot here captures the splash instead of the
  // dashboard. Wait for something that only exists once the app has painted,
  // then let panels settle.
  const waitSelector = process.env.PW_WAIT_SELECTOR;
  if (waitSelector) {
    await page.waitForSelector(waitSelector, { timeout: 60000 });
  } else {
    await page
      .waitForFunction(
        () => !document.body.innerText.includes("Loading Percona Monitoring and Management"),
        { timeout: 60000 },
      )
      .catch(() => {}); // non-PMM URLs never show the splash -- not an error
  }
  const settleMs = Number(process.env.PW_SETTLE_MS || 3000);
  if (settleMs > 0) {
    await page.waitForTimeout(settleMs);
  }

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });

  await browser.close();
  console.log(`Screenshot saved: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
