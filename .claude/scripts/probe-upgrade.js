"use strict";
const { chromium } = require("playwright");
const { spkiPinFromCertFile } = require("./lib/spki-pin");
const { proxyLaunchOptions } = require("./lib/proxy");

const dump = async (page, label) => {
  console.log(`\n===== ${label} =====`);
  console.log(`url = ${page.url()}`);
  for (const f of page.frames()) {
    const upg = await f.locator('//button//span[contains(text(), "Upgrade to")]').count().catch(() => 0);
    const upn = await f.locator('//button[contains(., "Update now")]').count().catch(() => 0);
    const btns = await f.locator("button").allInnerTexts().catch(() => []);
    const clean = btns.map(b => b.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (clean.length || upg || upn) {
      console.log(`  frame ${f.url().slice(0, 70)}`);
      console.log(`    "Upgrade to" = ${upg} | "Update now" BUTTON = ${upn}`);
      console.log(`    buttons = ${JSON.stringify(clean.slice(0, 25))}`);
    }
  }
};

(async () => {
  const url = process.env.PMM_URL;
  const pin = spkiPinFromCertFile(process.env.PMM_CERT_PATH);
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    ...proxyLaunchOptions({ spkiPins: [pin] }),
  });
  const ctx = await browser.newContext({
    storageState: `/workspace/pmm-qa/.claude/scripts/.sessions/${process.env.SESSION_ID}.json`,
    viewport: { width: 1920, height: 1200 },
  });
  const page = await ctx.newPage();

  // Straight to the Updates page: this is where "Update now" used to live.
  await page.goto(`${url}/pmm-ui/updates`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12000);
  await dump(page, "UPDATES PAGE /pmm-ui/updates on PMM 3.9.0");
  console.log("---- UPDATES PAGE TEXT ----");
  console.log((await page.locator("body").innerText()).replace(/\n{2,}/g, "\n").slice(0, 2500));
  await page.screenshot({ path: process.env.SHOT || "/tmp/shot.png", fullPage: true });
  await browser.close();
})();
