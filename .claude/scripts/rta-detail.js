#!/usr/bin/env node
// Opens the RTA tab and drills into a running session to capture live query data.
"use strict";
const path = require("node:path");
const { chromium } = require("playwright");
const { spkiPinFromCertFile } = require("./lib/spki-pin");
const { proxyLaunchOptions } = require("./lib/proxy");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [, , host, out, sessionId, service] = process.argv;
  const p = proxyLaunchOptions({ spkiPins: [spkiPinFromCertFile(process.env.PMM_CERT_PATH)] });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: p.args, proxy: p.proxy });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 },
    storageState: path.join(__dirname, ".sessions", `${sessionId}.json`) });
  const page = await ctx.newPage();
  await page.route("**/v1/server/updates?force=**", (r) => r.fulfill({ status: 200,
    contentType: "application/json", body: JSON.stringify({ installed: {}, last_check: new Date().toISOString(), latest: {}, update_available: false }) }));
  await page.goto(`${host}/graph/d/pmm-qan/pmm-query-analytics`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading Percona Monitoring and Management"), null, { timeout: 60000 });
  await sleep(9000);
  await page.getByText("Real-time", { exact: false }).first().click();
  await sleep(5000);
  await page.getByRole("link", { name: service }).first().click();
  await sleep(20000);
  await page.screenshot({ path: out });
  console.log("saved " + out);
  console.log("TEXT: " + (await page.evaluate(() => document.body.innerText)).slice(0, 700).replace(/\n+/g, " | "));
  await browser.close();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
