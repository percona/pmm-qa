const { chromium } = require('playwright');
const { proxyLaunchOptions } = require('./lib/proxy');

// Unlike pw-screenshot.js, this does NOT stub /v1/server/updates: that stub
// reports update_available:false, which hides the very state upgrade testing
// needs to see.

(async () => {
  const url = process.env.PMM_URL;
  const state = `${__dirname}/.sessions/${process.env.SESSION}.json`;
  const opts = proxyLaunchOptions({});
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: opts.args,
    proxy: opts.proxy,
  });
  const ctx = await browser.newContext({
    ...(process.env.ADMIN_PASSWORD ? {} : { storageState: state }),
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 1000 },
  });
  const page = await ctx.newPage();
  const calls = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/\/v1\/server\/(updates|version)|agents\/versions/.test(u)) {
      let body = '';
      try { body = (await r.text()).slice(0, 500); } catch {}
      calls.push(`${r.status()} ${u}\n    ${body.replace(/\s+/g, ' ')}`);
    }
  });
  if (process.env.ADMIN_PASSWORD) {
    await page.goto(url, { waitUntil: 'load' });
    const origin = new URL(page.url()).origin;
    if (origin !== new URL(url).origin) throw new Error(`redirected to ${origin}`);
    const r = await page.evaluate(
      async ({ origin, password }) => {
        const res = await fetch(`${origin}/graph/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: 'admin', password }),
          redirect: 'error',
        });
        return res.ok;
      },
      { origin, password: process.env.ADMIN_PASSWORD }
    );
    if (!r) throw new Error('login failed');
  }

  const path = process.env.PMM_PATH || '/pmm-ui/updates';
  await page.goto(`${url}${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(20000);
  console.log('--- API CALLS (no stub)');
  calls.forEach((c) => console.log(c));
  console.log('--- VISIBLE TEXT');
  console.log((await page.locator('body').innerText()).slice(0, 1500));
  console.log('--- DOM COUNTS');
  console.log(JSON.stringify(await page.evaluate(() => ({
    nav: document.querySelectorAll('nav').length,
    header: document.querySelectorAll('header').length,
    sidebarHomeLinks: [...document.querySelectorAll('a,div')].filter((e) => e.textContent.trim() === 'Home page').length,
    grafanaIframes: document.querySelectorAll('iframe').length,
  }))));
  console.log('--- BUTTONS');
  for (const b of await page.locator('button').all()) {
    const t = (await b.innerText()).trim();
    if (t) console.log(' •', t.replace(/\n/g, ' '));
  }
  const shot = process.env.PW_OUT;
  if (shot) await page.screenshot({ path: shot, fullPage: true });
  await browser.close();
})();
