#!/usr/bin/env node
// Capture pagination evidence for one Grafana panel: screenshot the panel on
// page 1, click a page button, screenshot it again, and report the pager state.
//
// Usage:
//   node pw-panel-pagination.js <dashboardUrl> <panelTitle> <outPrefix> [sessionId]
//
// Env knobs: PMM_CERT_PATH, PMM_UI_INSECURE, PW_SETTLE_MS,
//            PW_EXPAND_ROWS='Servers|Status' (row titles to expand first),
//            PW_PAGES='1,2' (page buttons to visit)
"use strict";

const fs = require("node:fs");
const { chromium } = require("playwright");
const { spkiPinFromCertFile } = require("./lib/spki-pin");
const { proxyLaunchOptions } = require("./lib/proxy");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [, , url, panelTitle, outPrefix, sessionId] = process.argv;
  if (!url || !panelTitle || !outPrefix) {
    console.error("usage: node pw-panel-pagination.js <url> <panelTitle> <outPrefix> [sessionId]");
    process.exit(1);
  }

  const insecure = process.env.PMM_UI_INSECURE === "1";
  const certPath = process.env.PMM_CERT_PATH;
  const spkiPins = !insecure && certPath ? [spkiPinFromCertFile(certPath)] : [];
  const settle = Number(process.env.PW_SETTLE_MS || 15000);
  const pages = (process.env.PW_PAGES || "1,2").split(",").map((s) => s.trim());

  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    ...proxyLaunchOptions({ spkiPins }),
  });
  const statePath = sessionId ? `${__dirname}/.sessions/${sessionId}.json` : null;
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: insecure,
    ...(statePath && fs.existsSync(statePath) ? { storageState: statePath } : {}),
  });
  const page = await context.newPage();

  // Grafana rotates auth tokens, so a storageState captured minutes ago lands on
  // /graph/login instead of the dashboard. Authenticate every request with basic
  // auth against PMM's own origin, the way pmm-ui-login.js does.
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const origin = new URL(url).origin;
    const token = Buffer.from(`admin:${adminPassword}`).toString("base64");
    await page.route(`${origin}/**`, (route) =>
      route.continue({ headers: { ...route.request().headers(), Authorization: `Basic ${token}` } }));
    await page.route("**/api/user/auth-tokens/rotate", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  }

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(settle);

  // The PMM shell reloads its inner Grafana iframe more than once while the
  // dashboard settles, so re-resolve the frame on every use instead of holding
  // a reference that goes stale.
  const gframe = () =>
    page.frames().find((f) => f.url().includes("/graph/") && !f.url().includes("/pmm-ui/")) || page.mainFrame();

  // Grafana only mounts collapsed row headers once they scroll into view, so a
  // row further down the dashboard is not in the DOM until the page is scrolled.
  const rowsWanted = (process.env.PW_EXPAND_ROWS || "").split("|").filter(Boolean);
  if (rowsWanted.length) {
    // The wheel event goes to whatever is under the pointer, and (0,0) is the
    // left nav, which does not scroll the dashboard.
    await page.mouse.move(1100, 600);
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, 1000);
      await sleep(1200);
    }
    await sleep(4000);
  }

  for (const rowTitle of rowsWanted) {
    const candidates = () => [
      gframe().getByRole("button", { name: rowTitle, exact: true }),
      gframe().locator(`[data-testid="data-testid dashboard-row-title-${rowTitle}"]`),
      gframe().getByText(rowTitle, { exact: true }),
    ];
    let clicked = false;
    for (let attempt = 0; attempt < 6 && !clicked; attempt++) {
      for (const c of candidates()) {
        const el = c.first();
        if ((await el.count().catch(() => 0)) > 0) {
          if (await el.click({ timeout: 10000 }).then(() => true).catch(() => false)) {
            clicked = true;
            break;
          }
        }
      }
      if (!clicked) await sleep(4000);
    }
    console.log(`row "${rowTitle}" expanded=${clicked}`);
    if (!clicked) {
      const dump = await gframe()
        .locator("button, [role='button'], h2, h3, summary")
        .evaluateAll((els) =>
          els.map((e) => `${e.tagName}:${(e.getAttribute("data-testid") || "").slice(0, 40)}:${(e.textContent || "").trim().slice(0, 30)}`)
             .filter((t) => t.split(":")[2]))
        .catch((e) => ["DUMP-ERR " + e.message]);
      console.log("  row candidates: " + JSON.stringify(dump.slice(0, 40)));
    }
    if (clicked) await sleep(8000);
  }

  const sel = `section[data-testid="data-testid Panel header ${panelTitle}"]`;
  let panel = null;
  for (let i = 0; i < 20; i++) {
    const p = gframe().locator(sel).first();
    if ((await p.count()) && (await p.isVisible().catch(() => false))) {
      panel = p;
      break;
    }
    await sleep(3000);
  }
  if (!panel) {
    const titles = await gframe()
      .locator('[data-testid^="data-testid Panel header"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))
      .catch(() => []);
    console.error(`panel "${panelTitle}" not found; present: ${JSON.stringify(titles)}`);
    process.exit(2);
  }
  await panel.scrollIntoViewIfNeeded();
  await sleep(3000);

  // Grafana 12 renders the state-timeline pager as a plain button list, not a
  // <nav>, so match the page buttons by their numeric label inside the panel.
  const pageBtn = (n) =>
    panel.locator("button").filter({ hasText: new RegExp(`^\\s*${n}\\s*$`) }).first();
  const buttons = (await panel.locator("button").allTextContents())
    .map((t) => t.trim())
    .filter((t) => /^\d+$/.test(t));
  const navCount = buttons.length;
  console.log(`panel=${JSON.stringify(panelTitle)} pagerPresent=${navCount > 0} pageButtons=${JSON.stringify(buttons)}`);

  for (const p of pages) {
    if (p !== pages[0] && navCount) {
      const btn = pageBtn(p);
      if (await btn.count()) {
        await btn.click();
        await sleep(4000);
      } else {
        console.log(`page button ${p} not found`);
        continue;
      }
    }
    const out = `${outPrefix}-page${p}.png`;
    await panel.screenshot({ path: out });
    console.log(`saved ${out}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
