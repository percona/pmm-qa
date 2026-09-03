// Drives a PMM UI-initiated upgrade end to end: Home dashboard -> update
// popup -> Updates page -> Update now -> completion. Deliberately does not
// stub /v1/server/updates the way pw-screenshot.js does; that stub reports
// update_available:false and hides the whole flow.
const fs = require('fs');
const { chromium } = require('playwright');
const { proxyLaunchOptions } = require('./lib/proxy');

const URL_BASE = process.env.PMM_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const OUT = process.env.OUT_PREFIX || '/tmp/pmm-upgrade';
const DEADLINE_MS = Number(process.env.DEADLINE_MS || 1500000);

const log = (...a) => console.log(new Date().toISOString(), ...a);

const version = async (page) => {
  try {
    const r = await page.request.get(`${URL_BASE}/v1/server/version`, { timeout: 15000 });
    if (!r.ok()) return `HTTP ${r.status()}`;
    const j = await r.json();
    return `${j.version} / managed=${j.managed?.full_version}`;
  } catch (e) {
    return `unreachable (${e.message.split('\n')[0]})`;
  }
};

(async () => {
  const opts = proxyLaunchOptions({});
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: opts.args,
    proxy: opts.proxy,
  });
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: `${OUT}-video`, size: { width: 1600, height: 1000 } },
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

  // Logs in here rather than reusing a pmm-ui-login.js storage state: that
  // helper stubs GET /v1/users/me and /v1/server/updates, and a run of it
  // left snoozed_pmm_version set, which suppresses the very popup step 2
  // needs. No stubs at all in this script.
  log('STEP 1: log in');
  await page.goto(URL_BASE, { waitUntil: 'load' });
  const origin = new URL(page.url()).origin;
  if (origin !== new URL(URL_BASE).origin) {
    throw new Error(`redirected to ${origin} — refusing to send credentials`);
  }
  const login = await page.evaluate(
    async ({ origin, password }) => {
      const res = await fetch(`${origin}/graph/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'admin', password }),
        redirect: 'error',
      });
      return { ok: res.ok, status: res.status };
    },
    { origin, password: ADMIN_PASSWORD }
  );
  if (!login.ok) throw new Error(`login failed: HTTP ${login.status}`);
  log('logged in');

  const userInfo = async (label) => {
    try {
      const r = await page.request.get(`${URL_BASE}/v1/users/me`, { timeout: 15000 });
      log(`users/me (${label}):`, (await r.text()).replace(/\s+/g, ' '));
    } catch (e) {
      log(`users/me (${label}): ${e.message.split('\n')[0]}`);
    }
  };
  await userInfo('after login');

  log('STEP 2: open Home dashboard inside the PMM shell');
  await page.goto(`${URL_BASE}/pmm-ui/graph/d/pmm-home`, { waitUntil: 'load' });
  const baseline = await version(page);
  log('baseline version:', baseline);

  log('waiting for the update popup');
  const goToUpdates = page.locator('[data-testid="update-modal-go-to-updates-button"]');
  await goToUpdates.waitFor({ state: 'visible', timeout: 120000 });
  const isSnackbar = await page.locator('[data-testid="update-modal-snackbar"]').count();
  const modalTitle = await page
    .locator('[data-testid="update-modal-title"], .MuiDialogTitle-root')
    .first()
    .innerText()
    .catch(() => '(no title node)');
  log(`popup visible as ${isSnackbar ? 'SNACKBAR (snooze_count>=1)' : 'MODAL'}, title:`,
    JSON.stringify(modalTitle.replace(/\s+/g, ' ')));
  await page.screenshot({ path: `${OUT}-02-popup.png` });

  log('clicking Go To Updates');
  await goToUpdates.click();
  const updateNow = page.locator('button:has-text("Update now")');
  await updateNow.waitFor({ state: 'visible', timeout: 60000 });
  log('STEP 3: Updates page reached, Update now visible');
  await page.screenshot({ path: `${OUT}-03-updates-page.png` });

  log('clicking Update now');
  await updateNow.click();

  log('STEP 4: waiting for the upgrade to finish');
  const started = Date.now();
  let shot = 0;
  let lastText = '';
  let changedAt = null;
  while (Date.now() - started < DEADLINE_MS) {
    await page.waitForTimeout(15000);
    const v = await version(page);
    let text = '';
    try {
      text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
    } catch (e) {
      text = `(dom unavailable: ${e.message.split('\n')[0]})`;
    }
    if (text !== lastText) {
      log(`[+${Math.round((Date.now() - started) / 1000)}s] version=${v}`);
      log('   page:', text);
      lastText = text;
      await page.screenshot({ path: `${OUT}-04-progress-${String(++shot).padStart(2, '0')}.png` }).catch(() => {});
    } else {
      log(`[+${Math.round((Date.now() - started) / 1000)}s] version=${v} (page unchanged)`);
    }
    if (!changedAt && !v.startsWith('unreachable') && !v.includes('HTTP') && v !== baseline) {
      changedAt = Date.now();
      log('*** server version changed:', baseline, '->', v);
    }
    if (changedAt && Date.now() - changedAt > 90000) break;
  }

  log('final version:', await version(page));
  await page.screenshot({ path: `${OUT}-05-final.png`, fullPage: true });
  const counts = await page.evaluate(() => ({
    nav: document.querySelectorAll('nav').length,
    header: document.querySelectorAll('header').length,
    sidebarHomeLinks: [...document.querySelectorAll('a,div')].filter((e) => e.textContent.trim() === 'Home page').length,
    grafanaIframes: document.querySelectorAll('iframe').length,
  })).catch((e) => ({ error: e.message }));
  log('DOM counts (duplicate-nav check):', JSON.stringify(counts));
  log('console errors:', consoleErrors.length);
  consoleErrors.slice(0, 15).forEach((e) => log('   !', e));

  await ctx.close();
  await browser.close();
  const vids = fs.existsSync(`${OUT}-video`) ? fs.readdirSync(`${OUT}-video`) : [];
  log('video:', vids.map((v) => `${OUT}-video/${v}`).join(' '));
})();
