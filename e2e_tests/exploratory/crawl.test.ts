import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import LoginPage from '@pages/login.page';
import { JevExplorer } from './jev.client';
import { dismissOverlays, fingerprint, snapshot } from './perception';
import { StepRecord, writeFilmstrip } from './report';

const BUDGET_MS = Number(process.env.CRAWL_BUDGET_MS ?? 5 * 60 * 1_000);
const BROKEN_THRESHOLD = Number(process.env.CRAWL_BROKEN_THRESHOLD ?? 0.93);
const MIN_CONFIDENCE = Number(process.env.CRAWL_MIN_CONFIDENCE ?? 0.5);
const STUCK_LIMIT = Number(process.env.CRAWL_STUCK_LIMIT ?? 3);
const ARTIFACTS = path.resolve(__dirname, 'findings');

test('exploratory crawl of the PMM UI', async ({ page }) => {
  test.setTimeout(BUDGET_MS + 120_000);
  fs.mkdirSync(`${ARTIFACTS}/shots`, { recursive: true });

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)));
  page.on(
    'response',
    (r) => r.status() >= 500 && failedRequests.push(`${r.status()} ${r.url().slice(0, 120)}`),
  );

  await page.goto('/');
  await new LoginPage(page).login(process.env.ADMIN_PASSWORD ?? 'admin');

  // Both tours are a real user setting, so completing them beats mocking the route.
  await page.request
    .put('/v1/users/me', { data: { alerting_tour_completed: true, product_tour_completed: true } })
    .catch(() => undefined);

  const search = await page.request.get('/graph/api/search?type=dash-db&limit=200').catch(() => undefined);
  const frontier: string[] = search
    ? ((await search.json()) as { url: string }[]).map((d) => d.url)
    : ['/graph/d/pmm-home/home-dashboard'];
  const jev = new JevExplorer();
  const visited: string[] = [];
  const findings: Record<string, unknown>[] = [];
  const perceptionMs: number[] = [];
  const clicked = new Set<string>();
  const timeline: StepRecord[] = [];
  const deadline = Date.now() + BUDGET_MS;
  let steps = 0;
  let fallbacks = 0;
  let unstucks = 0;
  let repeats = 0;
  let previous = '';

  while (Date.now() < deadline) {
    await dismissOverlays(page);

    const t0 = Date.now();
    const state = await snapshot(page, visited, consoleErrors, failedRequests);

    perceptionMs.push(Date.now() - t0);

    if (state.candidates.length === 0) {
      await page.goBack();

      continue;
    }

    const here = fingerprint(state);

    repeats = here === previous ? repeats + 1 : 0;
    previous = here;

    // Rigid unstick: a screen that will not change is a navigation problem, not a judgement call.
    if (repeats >= STUCK_LIMIT) {
      const next = frontier[(unstucks += 1) % frontier.length];

      repeats = 0;
      await page.goto(`${next}?from=now-3h&to=now`).catch(() => undefined);

      continue;
    }

    const verdict = await jev.decide(state);

    steps += 1;
    visited.push(here);

    const shot = `shots/step-${String(steps).padStart(3, '0')}.jpg`;

    await page.screenshot({ path: `${ARTIFACTS}/${shot}`, quality: 55, type: 'jpeg' }).catch(() => undefined);

    const flagged = verdict.broken > BROKEN_THRESHOLD;

    if (flagged) {
      const id = `finding-${findings.length}`;

      fs.writeFileSync(`${ARTIFACTS}/${id}.json`, JSON.stringify({ ...state, verdict }, null, 2));
      findings.push({ broken: verdict.broken, id, shot, title: state.title, url: state.url });
    }

    // Jev picks while it is sure; below that a rigid least-visited rule is the better oracle.
    const deadEnd = verdict.deadEnd > 0.9;
    const confident = verdict.next !== undefined && verdict.nextConfidence >= MIN_CONFIDENCE;

    if (!confident && !deadEnd) fallbacks += 1;
    const chosen = confident && verdict.next !== undefined ? state.candidates[verdict.next] : undefined;
    const target = deadEnd
      ? undefined
      : (chosen ?? state.candidates.find((c) => !clicked.has(c.name)) ?? state.candidates[0]);

    timeline.push({
      action: target ? `${target.role} "${target.name}"` : 'back',
      broken: verdict.broken,
      confidence: verdict.nextConfidence,
      deadEnd: verdict.deadEnd,
      flagged,
      latencyMs: verdict.latencyMs,
      n: steps,
      shot,
      source: confident ? 'jev' : 'fallback',
      title: state.title,
      url: state.url,
    });

    if (!target) {
      await page.goBack().catch(() => page.goto('/'));

      continue;
    }

    clicked.add(target.name);

    const frame = page.frames()[target.frame];

    await frame
      ?.getByRole(target.role, { exact: false, name: target.name })
      .first()
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  }

  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
  const summary = {
    fallbacks,
    findings: findings.length,
    jev: jev.stats(),
    perceptionMeanMs: mean(perceptionMs),
    steps,
    unstucks,
  };

  fs.writeFileSync(`${ARTIFACTS}/report.json`, JSON.stringify({ ...summary, findings }, null, 2));
  writeFilmstrip(ARTIFACTS, timeline, summary);
  expect(steps, 'the crawler took at least one decision').toBeGreaterThan(0);
  console.log(
    `steps=${steps} fallbacks=${fallbacks} jev=${JSON.stringify(jev.stats())} perception_mean_ms=${mean(perceptionMs)} findings=${findings.length}`,
  );
});
