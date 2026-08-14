"use strict";
// HA dashboard evidence: log into PMM (admin/admin) and screenshot dashboard
// URLs. Uses ignoreHTTPSErrors because outbound TLS is MITM'd by the mandated
// egress gateway, so SPKI-pinning PMM's own cert can't match. Password is the
// default 'admin' on this throwaway HA cluster.
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { proxyLaunchOptions } = require("./lib/proxy");

async function main() {
  const pmmUrl = process.env.PMM_URL;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";
  const settle = Number(process.env.PW_SETTLE_MS || 15000);
  const shots = JSON.parse(process.env.SHOTS || "[]"); // [{url, out}]
  const pmmOrigin = new URL(pmmUrl).origin;
  const authToken = Buffer.from(`admin:${adminPassword}`).toString("base64");

  const proxyOpts = proxyLaunchOptions();
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    headless: true,
    args: [...proxyOpts.args],
    proxy: proxyOpts.proxy,
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1200 },
  });
  const page = await context.newPage();
  await page.route(`${pmmOrigin}/**`, async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), Authorization: `Basic ${authToken}` },
    });
  });
  await page.route("**/api/user/auth-tokens/rotate", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/v1/users/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ alerting_tour_completed: true, product_tour_completed: true, snoozed_pmm_version: "", user_id: 1 }) }));
  await page.route("**/v1/server/updates?**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ installed: {}, last_check: new Date().toISOString(), latest: {}, update_available: false }) }));

  await page.goto(pmmUrl, { waitUntil: "domcontentloaded" });
  const loginResult = await page.evaluate(async ({ pmmOrigin, adminPassword }) => {
    try {
      const res = await fetch(`${pmmOrigin}/graph/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "admin", password: adminPassword }), redirect: "error",
      });
      return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 200) };
    } catch (err) { return { ok: false, status: 0, text: err.message }; }
  }, { pmmOrigin, adminPassword });
  console.log("login:", JSON.stringify(loginResult));

  for (const s of shots) {
    try {
      await page.goto(s.url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(settle);
      if (s.clickText) {
        try {
          await page.getByText(s.clickText, { exact: false }).first().click({ timeout: 8000 });
          await page.waitForTimeout(2500);
        } catch (e) { console.error("click failed:", s.clickText, e.message); }
      }
      if (s.full) {
        // Grafana virtualizes panels; scroll through to force lazy render.
        const h = await page.evaluate(() => document.body.scrollHeight);
        for (let y = 0; y < h; y += 700) {
          await page.evaluate((yy) => window.scrollTo(0, yy), y);
          await page.waitForTimeout(1200);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: s.out, fullPage: Boolean(s.full) });
      console.log("shot:", s.out);
    } catch (err) { console.error("shot FAILED", s.out, err.message); }
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
