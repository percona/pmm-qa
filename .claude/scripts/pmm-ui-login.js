#!/usr/bin/env node
// Log into PMM UI with the pre-installed Chromium, bypassing the Grafana
// login form on a freshly provisioned box.
//
// Usage:
//   PMM_URL='https://<linode-ip>'          node pmm-ui-login.js PMM-14576
//   ADMIN_PASSWORD='...'                   (optional, defaults to 'pmm3admin!')
//   PMM_CERT_PATH='runs/<run_id>/pmm_cert.pem'  (required -- pins PMM's own
//     cert instead of trusting any cert; see pmm-linode-provisioning skill)
//
// Writes a reusable Playwright storage state to
// .claude/scripts/.sessions/<SESSION_ID>.json — pass that file to a
// screenshot/interaction script via `storageState` to skip logging in again.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { spkiPinFromCertFile } = require("./lib/spki-pin");

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sessionId)) {
    console.error(
      "usage: node pmm-ui-login.js <SESSION_ID>  e.g. PMM-14576 (letters, digits, '_', '-' only)",
    );
    process.exit(1);
  }

  const pmmUrl = process.env.PMM_URL || "https://127.0.0.1";
  if (!/^https:\/\//i.test(pmmUrl)) {
    console.error(`PMM_URL must be an https:// URL, got: ${pmmUrl}`);
    process.exit(1);
  }
  const adminPassword = process.env.ADMIN_PASSWORD || "pmm3admin!";
  const headed = process.env.PMM_UI_HEADED !== "0";
  const width = Number(process.env.PMM_UI_WIDTH || 1920);
  const height = Number(process.env.PMM_UI_HEIGHT || 1200);

  const sessionsDir = path.join(__dirname, ".sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  const storageStatePath = path.join(sessionsDir, `${sessionId}.json`);
  if (path.relative(sessionsDir, storageStatePath).startsWith("..")) {
    console.error(`invalid session id '${sessionId}': resolves outside .sessions/`);
    process.exit(1);
  }

  const authToken = Buffer.from(`admin:${adminPassword}`).toString("base64");

  // This script only ever targets PMM, so there's no legitimate case for an
  // insecure fallback -- require the cert pin rather than silently trusting
  // any certificate on a connection that's about to carry the admin
  // password. PMM's cert can't be known before the box exists, but once
  // PMM is up, its cert is fetched over the already-pinned exec-server (see
  // pmm-linode-provisioning's readyz step) and passed here via PMM_CERT_PATH.
  const certPath = process.env.PMM_CERT_PATH;
  if (!certPath) {
    console.error(
      "PMM_CERT_PATH is required -- fetch PMM's cert after readyz (see pmm-linode-provisioning skill) and pass it here.",
    );
    process.exit(1);
  }
  if (!fs.existsSync(certPath)) {
    console.error(`PMM_CERT_PATH set but not found: ${certPath}`);
    process.exit(1);
  }
  const launchArgs = [`--ignore-certificate-errors-spki-list=${spkiPinFromCertFile(certPath)}`];

  // Explicit executablePath: the pre-installed Chromium revision at
  // /opt/pw-browsers can drift from what a freshly `npm install`-ed
  // playwright expects (confirmed live -- an unpinned minor bump silently
  // wants a browser revision that isn't there), so don't rely on
  // Playwright's own bundled-browser resolution to find it.
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    headless: !headed,
    args: launchArgs,
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    viewport: { width, height },
  });
  const page = await context.newPage();

  // Scoped to PMM's own origin only, not every request the page makes --
  // an https-to-http redirect or a third-party resource load won't carry
  // this Basic-auth header along with it.
  const pmmOrigin = new URL(pmmUrl).origin;
  await page.route(`${pmmOrigin}/**`, async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), Authorization: `Basic ${authToken}` },
    });
  });
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

  // page.goto can follow a redirect to a different origin before this point
  // (an open redirect on the box, a misconfigured proxy) -- the Basic-auth
  // route above is origin-scoped, but that alone doesn't stop the *login
  // POST* below from being built against wherever navigation actually
  // landed. Refuse to send the admin password anywhere but pmmOrigin,
  // instead of trusting page.url()'s origin after the fact.
  const finalOrigin = new URL(page.url()).origin;
  if (finalOrigin !== pmmOrigin) {
    throw new Error(
      `PMM_URL redirected to a different origin (${finalOrigin}) -- refusing to send credentials there.`,
    );
  }

  // Deliberately page.evaluate + in-page fetch, not page.request.post:
  // Playwright's request context is a separate Node-side HTTP client that
  // does not go through Chromium at all, so it ignores the
  // --ignore-certificate-errors-spki-list launch flag above (confirmed
  // live -- it fails closed with "self-signed certificate" even with a
  // correct pin). Routing this through the page's own fetch keeps the
  // login POST -- the one call that actually carries the admin password --
  // on the same pinned trust path as every other page request.
  const loginResult = await page.evaluate(
    async ({ pmmOrigin, adminPassword }) => {
      const res = await fetch(`${pmmOrigin}/graph/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "admin", password: adminPassword }),
      });
      return { ok: res.ok, status: res.status, text: await res.text() };
    },
    { pmmOrigin, adminPassword },
  );
  if (!loginResult.ok) {
    throw new Error(`Login failed: HTTP ${loginResult.status} ${loginResult.text}`);
  }
  await page.goto(`${pmmOrigin}/pmm-ui/help`);

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
