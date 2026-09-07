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
//      PW_WAIT_SELECTOR, PMM_UI_WIDTH/HEIGHT

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { proxyLaunchOptions } = require("./lib/proxy");
const { spkiPinFromCertFile } = require("./lib/spki-pin");

const UPDATES = "/v1/server/updates";

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
    window.__toasts = [];
    const seen = new Set();
    const isToast = (n) =>
      n.getAttribute &&
      (n.getAttribute("role") === "alert" ||
        String(n.className || "").includes("notistack"));
    const record = (root) => {
      if (!(root instanceof Element)) return;
      for (const n of [root, ...root.querySelectorAll("*")]) {
        if (!isToast(n)) continue;
        const text = (n.textContent || "").trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          window.__toasts.push(text);
        }
      }
    };
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) record(n);
    }).observe(document.documentElement, { childList: true, subtree: true });
  });

  const requests = [];
  const responses = [];
  page.on("request", (req) => {
    if (req.url().includes(UPDATES)) {
      requests.push({ method: req.method(), url: req.url() });
    }
  });
  page.on("response", async (res) => {
    if (!res.url().includes(UPDATES)) return;
    let body = null;
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      /* body already consumed or navigation raced */
    }
    responses.push({ status: res.status(), url: res.url(), body });
  });

  await page.goto(url, { waitUntil: "networkidle" });

  const waitSelector = process.env.PW_WAIT_SELECTOR;
  if (waitSelector) {
    await page
      .waitForSelector(waitSelector, { timeout: 60000 })
      .catch(() => console.error(`warn: never saw ${waitSelector}`));
  }
  await page.waitForTimeout(Number(process.env.PW_SETTLE_MS || 8000));

  const footer = page.locator('[data-testid="pmm-footer"]').first();
  let footerText = null;
  if (await footer.count()) {
    footerText = (await footer.textContent().catch(() => null))?.trim() ?? null;
  }
  const toasts = await page.evaluate(() => window.__toasts || []);

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
        footerText,
        footerHasCheckDate: /Last checked/i.test(footerText || ""),
        footerHasInvalidDate: /Invalid Date|NaN/i.test(footerText || ""),
        toasts,
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
