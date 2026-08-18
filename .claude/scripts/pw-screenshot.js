#!/usr/bin/env node
// Generic one-off screenshot helper for QA evidence — replaces Cursor's
// `playwright-cli` with the pre-installed Chromium directly.
//
// Usage:
//   node pw-screenshot.js <url> <output.png> [sessionId]
//
// Env knobs:
//   PMM_UI_INSECURE=1   disable TLS verification (HA/LKE: self-signed cert
//                       behind the egress MITM — pairs with pmm-ui-login.js's
//                       same flag)
//   PW_SCROLL=1         scroll the page top-to-bottom first to force Grafana's
//                       virtualized panels to render before a fullPage shot
//   PW_CLICK_TEXT='...' click an element by partial text before capturing
//   PW_NO_PROXY=1       reach the target with a DIRECT connection (no agent
//                       proxy). Auto-enabled for github.com hosts: the agent's
//                       GitHub credential proxy serves repo-scoped REST only, so
//                       a github.com web page (e.g. an Actions run) comes back as
//                       a 403 JSON through the proxy. Network egress is Full, so
//                       the direct path renders the real page (public repos only
//                       — the direct path carries no GitHub auth).
//   PW_SETTLE_MS, PW_WAIT_SELECTOR, PMM_UI_WIDTH/HEIGHT   as before
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
const { proxyLaunchOptions, directEgressLaunchOptions } = require("./lib/proxy");

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

  // PMM_UI_INSECURE=1 disables TLS verification (no pin) — for HA/LKE, where
  // PMM's cert is self-signed and the egress gateway MITMs outbound TLS, so
  // SPKI-pinning can't match. Strict pinning stays the default everywhere else.
  const insecure = process.env.PMM_UI_INSECURE === "1";
  // PMM_CERT_PATH (see pmm-ui-login.js) pins PMM's own cert instead of
  // trusting any cert -- optional since this script also screenshots
  // non-PMM pages (e.g. a GitHub Actions run) with a real CA already, which
  // strict verification (the default below) already handles fine.
  const certPath = process.env.PMM_CERT_PATH;
  const spkiPins = [];
  if (certPath && !insecure) {
    if (!fs.existsSync(certPath)) {
      console.error(`PMM_CERT_PATH set but not found: ${certPath}`);
      process.exit(1);
    }
    spkiPins.push(spkiPinFromCertFile(certPath));
  }

  const contextOpts = { ignoreHTTPSErrors: insecure, viewport: { width, height } };
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
  // github.com is intercepted by the agent's GitHub credential proxy (repo-scoped
  // REST only) — a web page navigated through it returns a 403 JSON, not HTML. So
  // bypass the proxy for github.com hosts (or when PW_NO_PROXY=1) to take the
  // direct egress path, which serves the real page. Direct = unauthenticated, fine
  // for public repos (e.g. an FB Actions run on Percona-Lab/pmm-submodules).
  let directEgress = process.env.PW_NO_PROXY === "1";
  try {
    directEgress = directEgress || /(^|\.)github\.com$/i.test(new URL(url).hostname);
  } catch { /* non-URL arg: leave as-is */ }
  const proxyOpts = directEgress
    ? directEgressLaunchOptions({ spkiPins })
    : proxyLaunchOptions({ spkiPins });
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: proxyOpts.args,
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

  // PW_CLICK_TEXT: click an element by (partial) text before capturing — e.g. to
  // open a collapsed row or expand a section on the dashboard.
  const clickText = process.env.PW_CLICK_TEXT;
  if (clickText) {
    try {
      await page.getByText(clickText, { exact: false }).first().click({ timeout: 8000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      console.error("click failed:", clickText, e.message);
    }
  }

  // PW_SCROLL=1: Grafana virtualizes panels, so a fullPage shot of a tall HA
  // dashboard misses panels that never scrolled into view. Scroll through to
  // force lazy render, then return to the top before capturing.
  if (process.env.PW_SCROLL === "1") {
    // Re-read scrollHeight each step: lazy panels expand the page as they render,
    // so a height captured once up front would stop the loop short and miss lower
    // panels. Continue until the bottom is reached and the height has settled.
    // Cap the iterations so a page that keeps growing can't hang the shot.
    let y = 0;
    let prevH = -1;
    for (let i = 0; i < 60; i++) {
      const scrollH = await page.evaluate(() => document.body.scrollHeight);
      if (y >= scrollH && scrollH === prevH) break;
      prevH = scrollH;
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(1000);
      y += 700;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
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
