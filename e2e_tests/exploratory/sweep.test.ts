import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import LoginPage from '@pages/login.page';
import { JevExplorer } from './jev.client';
import { writeFilmstrip, StepRecord } from './report';

const LIMIT = Number(process.env.SWEEP_LIMIT ?? 40);
const LABEL = process.env.SWEEP_LABEL ?? 'baseline';
const ARTIFACTS = path.resolve(__dirname, `findings-${LABEL}`);

interface Dash {
  title: string;
  url: string;
}

test('sweep every dashboard and judge it', async ({ page }) => {
  test.setTimeout(30 * 60 * 1_000);
  fs.mkdirSync(`${ARTIFACTS}/shots`, { recursive: true });

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(0, 120)}`);
  });

  await page.goto('/');
  await new LoginPage(page).login(process.env.ADMIN_PASSWORD ?? 'admin');

  const search = await page.request.get('/graph/api/search?type=dash-db&limit=1000');
  const dashboards: Dash[] = (await search.json()).slice(0, LIMIT);

  expect(dashboards.length, 'dashboards discovered').toBeGreaterThan(0);

  const jev = new JevExplorer();
  const timeline: StepRecord[] = [];
  const flagged: Record<string, unknown>[] = [];
  const renderMs: number[] = [];

  for (const [i, dash] of dashboards.entries()) {
    consoleErrors.length = 0;
    failedRequests.length = 0;

    const t0 = Date.now();

    await page.goto(`${dash.url}?from=now-3h&to=now&refresh=`).catch(() => undefined);

    const frame = page.frameLocator('#grafana-iframe');

    await frame
      .locator('[data-testid^="data-testid Panel header"]')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => undefined);
    await expect
      .poll(async () => (await page.content()).length, { intervals: [1_000, 1_000, 1_000], timeout: 12_000 })
      .toBeGreaterThan(0);

    const body = page.frames().map((f) => f.locator('body'));
    const texts = await Promise.all(body.map((b) => b.innerText({ timeout: 5_000 }).catch(() => '')));

    renderMs.push(Date.now() - t0);

    const shot = `shots/dash-${String(i).padStart(3, '0')}.jpg`;

    await page.screenshot({ path: `${ARTIFACTS}/${shot}`, quality: 55, type: 'jpeg' }).catch(() => undefined);

    const verdict = await jev.judge({
      consoleErrors: consoleErrors.slice(0, 5),
      failedRequests: failedRequests.slice(0, 5),
      title: dash.title,
      url: page.url(),
      visibleText: texts.join('\n').slice(0, 2_500),
    });
    const isFlagged = verdict.broken > 0.8 || verdict.noData > 0.8;

    if (isFlagged) flagged.push({ ...verdict, shot, title: dash.title, url: dash.url });

    timeline.push({
      action: `no-data ${verdict.noData.toFixed(2)}`,
      broken: verdict.broken,
      confidence: verdict.noData,
      deadEnd: verdict.noData,
      flagged: isFlagged,
      latencyMs: verdict.latencyMs,
      n: i,
      shot,
      source: 'jev',
      title: dash.title,
      url: dash.url,
    });
  }

  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
  const summary = {
    dashboards: dashboards.length,
    flagged: flagged.length,
    jev: jev.stats(),
    label: LABEL,
    renderMeanMs: mean(renderMs),
  };

  fs.writeFileSync(`${ARTIFACTS}/report.json`, JSON.stringify({ ...summary, flagged }, null, 2));
  writeFilmstrip(ARTIFACTS, timeline, summary);
  console.log(JSON.stringify(summary));
});
