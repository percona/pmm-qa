#!/usr/bin/env node
// Drives a PMM Real-Time Analytics session across a connection disruption.
// Usage: node rta-session.js <pmmHost> <outDir> <sessionId> <serviceName> <disruptCmd>
"use strict";
const path = require("node:path");
const fs = require("node:fs");
const { execSync } = require("node:child_process");
const { chromium } = require("playwright");
const { spkiPinFromCertFile } = require("./lib/spki-pin");
const { proxyLaunchOptions } = require("./lib/proxy");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [, , host, outDir, sessionId, service, disruptCmd] = process.argv;
  fs.mkdirSync(outDir, { recursive: true });
  const spkiPins = [spkiPinFromCertFile(process.env.PMM_CERT_PATH)];
  const p = proxyLaunchOptions({ spkiPins });
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: p.args, proxy: p.proxy,
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: path.join(__dirname, ".sessions", `${sessionId}.json`),
  });
  const page = await ctx.newPage();
  await page.route("**/v1/server/updates?force=**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ installed: {}, last_check: new Date().toISOString(), latest: {}, update_available: false }) }));

  const shot = async (name) => {
    const f = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: f });
    console.log(`shot: ${name}`);
  };

  await page.goto(`${host}/graph/d/pmm-qan/pmm-query-analytics`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading Percona Monitoring and Management"), null, { timeout: 60000 });
  await sleep(10000);
  await shot("00-loaded");
  console.log("URL: " + page.url());
  console.log("TEXT: " + (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\n+/g, " | "));
  const tab = page.getByText("Real-time", { exact: false }).first();
  await tab.waitFor({ state: "visible", timeout: 60000 });
  await tab.click();
  await sleep(4000);

  // pick the service
  const combo = page.getByPlaceholder(/Search cluster\/service/i).first();
  await combo.click();
  await combo.fill(service);
  await sleep(2500);
  await page.locator(".MuiAutocomplete-popper").getByText(service, { exact: true }).first().click();
  await page.locator(".MuiAutocomplete-popper").waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  await sleep(1500);
  await shot("01-service-selected");

  await page.keyboard.press("Escape");
  await sleep(1000);
  await page.locator("[data-testid=start-realtime-session]").click();
  console.log("session started");
  await sleep(20000);
  await shot("02-live-data");

  console.log("triggering disruption...");
  try { console.log(execSync(disruptCmd, { encoding: "utf8" }).trim()); }
  catch (e) { console.log("disrupt error: " + e.message); }

  for (const [i, wait] of [15000, 30000, 45000].entries()) {
    await sleep(wait);
    await shot(`03-during-${i + 1}`);
  }
  await sleep(120000);
  await shot("04-end-state");

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
