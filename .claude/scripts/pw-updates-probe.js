// Evidence probe for the PMM update-check path (PMM-15274).
//
// Deliberately does NOT stub `/v1/server/updates` the way pw-screenshot.js and
// pmm-ui-login.js do. That stub always answers 200 with a fresh `last_check`,
// which would hide the three things under test here: which request the UI
// actually sends, the 400 it gets on a disabled deployment, and the footer with
// no check date.
//
// Records every `/v1/server/updates` request and response, every toast raised
// while the page loads (via MutationObserver, since notistack auto-dismisses
// before a post-hoc query would see it), and the footer text. Prints JSON.
//
//   PMM_URL=https://1-2-3-4.nip.io \
//   PMM_CERT_PATH=terraform/linode-runner/runs/<run>/pmm_cert.pem \
//     node pw-updates-probe.js /pmm-ui/settings/advanced-settings out.png PMM-15274
//
// Env: PMM_URL, PMM_CERT_PATH | PMM_UI_INSECURE=1, PW_SETTLE_MS,
//      PW_WAIT_SELECTOR, PMM_UI_WIDTH/HEIGHT,
//      PW_SET_CHECKBOX="<data-testid>=on|off", PW_CLICK_TEXT, PW_AFTER_CLICK_MS

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { proxyLaunchOptions } = require("./lib/proxy");
const { spkiPinFromCertFile } = require("./lib/spki-pin");

const UPDATES = "/v1/server/updates";
const SETTINGS = "/v1/server/settings";

async function main() {
  const [, , target, outputPath, sessionId] = process.argv;
  if (!target || !outputPath) {
    console.error(
      "usage: node pw-updates-probe.js <path|url> <output.png> [sessionId]",
    );
    process.exit(1);
  }

  const base = process.env.PMM_URL || "https://127.0.0.1";
  const url = /^https?:\/\//.test(target)
    ? target
    : `${base.replace(/\/$/, "")}/${target.replace(/^\//, "")}`;

  const width = Number(process.env.PMM_UI_WIDTH || 1920);
  const height = Number(process.env.PMM_UI_HEIGHT || 1080);
  const insecure = process.env.PMM_UI_INSECURE === "1";

  const spkiPins = [];
  const certPath = process.env.PMM_CERT_PATH;
  if (certPath && !insecure) {
    if (!fs.existsSync(certPath)) {
      console.error(`PMM_CERT_PATH set but not found: ${certPath}`);
      process.exit(1);
    }
    spkiPins.push(spkiPinFromCertFile(certPath));
  }

  const contextOpts = {
    ignoreHTTPSErrors: insecure,
    viewport: { width, height },
  };
  if (sessionId) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sessionId)) {
      console.error(`invalid sessionId '${sessionId}'`);
      process.exit(1);
    }
    const sessionsDir = path.join(__dirname, ".sessions");
    const storageStatePath = path.join(sessionsDir, `${sessionId}.json`);
    if (path.relative(sessionsDir, storageStatePath).startsWith("..")) {
      console.error(`invalid sessionId '${sessionId}'`);
      process.exit(1);
    }
    if (fs.existsSync(storageStatePath)) {
      contextOpts.storageState = storageStatePath;
    }
  }

  const proxyOpts = proxyLaunchOptions({ spkiPins });
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: proxyOpts.args,
    proxy: proxyOpts.proxy,
  });
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  // Toasts auto-dismiss, so catch them as they are inserted rather than
  // querying after the fact.
  await page.addInitScript(() => {
    const SNACK =
      '[class*="notistack"], [role="alert"], .MuiSnackbar-root, .MuiAlert-root';
    window.__toasts = [];
    const seen = new Set();
    const add = (text) => {
      const t = (text || "").trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        window.__toasts.push(t);
      }
    };
    const scan = (root) => {
      if (!(root instanceof Element)) return;
      if (root.matches?.(SNACK)) add(root.textContent);
      root.querySelectorAll?.(SNACK).forEach((n) => add(n.textContent));
    };
    // addInitScript runs at document-start, before documentElement exists, so
    // observing it throws and takes the rest of this script with it. document
    // is always present.
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) scan(n);
    }).observe(document, { childList: true, subtree: true });
    // notistack inserts the snackbar node before React fills its children, so
    // the observer can see it while textContent is still empty. Re-scan on a
    // timer to catch the text once it lands, and to survive auto-dismiss.
    setInterval(() => scan(document.body), 250);
  });

  const requests = [];
  const responses = [];
  const settingsRequests = [];
  const settingsResponses = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes(UPDATES)) {
      requests.push({ method: req.method(), url });
    } else if (url.includes(SETTINGS)) {
      settingsRequests.push({ method: req.method(), url });
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    const isUpdates = url.includes(UPDATES);
    if (!isUpdates && !url.includes(SETTINGS)) return;
    let body = null;
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      /* body already consumed or navigation raced */
    }
    (isUpdates ? responses : settingsResponses).push({
      status: res.status(),
      method: res.request().method(),
      url,
      body,
    });
  });

  await page.goto(url, { waitUntil: "networkidle" });

  const waitSelector = process.env.PW_WAIT_SELECTOR;
  if (waitSelector) {
    await page
      .waitForSelector(waitSelector, { timeout: 60000 })
      .catch(() => console.error(`warn: never saw ${waitSelector}`));
  }
  await page.waitForTimeout(Number(process.env.PW_SETTLE_MS || 8000));

  // PW_SET_CHECKBOX="<data-testid>=on|off" flips a MUI switch, whose real input
  // is transparent and overlaid, so setChecked drives it rather than a click on
  // the visible track.
  const setCheckbox = process.env.PW_SET_CHECKBOX;
  if (setCheckbox) {
    const [testId, want] = setCheckbox.split("=");
    const box = page
      .getByTestId(testId)
      .locator('input[type="checkbox"]')
      .first();
    const before = await box.isChecked();
    await box.setChecked(want === "on");
    console.error(
      `PW_SET_CHECKBOX ${testId}: ${before} -> ${await box.isChecked()}`,
    );
  }

  const clickText = process.env.PW_CLICK_TEXT;
  if (clickText) {
    await page.getByRole("button", { name: clickText }).click();
    await page.waitForTimeout(Number(process.env.PW_AFTER_CLICK_MS || 5000));
  }

  const footer = page.locator('[data-testid="pmm-footer"]').first();
  let footerText = null;
  if (await footer.count()) {
    footerText = (await footer.textContent().catch(() => null))?.trim() ?? null;
  }
  const toastProbe = await page.evaluate(() => {
    const SNACK =
      '[class*="notistack"], [role="alert"], .MuiSnackbar-root, .MuiAlert-root';
    return {
      installed: typeof window.__toasts !== "undefined",
      toasts: window.__toasts || [],
      domNow: [...document.querySelectorAll(SNACK)].map((n) => ({
        cls: (n.className || "").toString().slice(0, 60),
        text: (n.textContent || "").trim().slice(0, 160),
      })),
      frames: [...document.querySelectorAll("iframe")].map(
        (f) => f.getAttribute("src") || "(no src)",
      ),
    };
  });
  const toasts = toastProbe.toasts;

  await page.screenshot({ path: outputPath, fullPage: false });
  await browser.close();

  const q = (u) => {
    try {
      return Object.fromEntries(new URL(u).searchParams);
    } catch {
      return {};
    }
  };

  console.log(
    JSON.stringify(
      {
        url,
        screenshot: outputPath,
        updatesRequests: requests.map((r) => ({ ...r, params: q(r.url) })),
        updatesResponses: responses.map((r) => ({
          status: r.status,
          params: q(r.url),
          body: r.body,
        })),
        settingsRequests: settingsRequests.map((r) => r.method),
        settingsResponses: settingsResponses.map((r) => ({
          method: r.method,
          status: r.status,
          body: r.body,
        })),
        footerText,
        footerHasCheckDate: /Last checked/i.test(footerText || ""),
        footerHasInvalidDate: /Invalid Date|NaN/i.test(footerText || ""),
        toasts,
        toastProbeInstalled: toastProbe.installed,
        snackbarDomAtCapture: toastProbe.domNow,
        iframes: toastProbe.frames,
        disabledToast: toasts.filter((t) => /updates are disabled/i.test(t)),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
