import { Page } from '@playwright/test';
import { Candidate, Snapshot } from './jev.client';

const MAX_CANDIDATES = 24;
const MAX_TEXT = 1_500;
// Rigid on purpose: anything irreversible is code's call, never the model's.
const FORBIDDEN =
  /sign out|log ?out|delete|remove|restart|shut ?down|reset|revoke|uninstall|drop |terminate/i;
const INTERACTIVE = /^\s*- (button|link|tab|menuitem|checkbox|combobox)(?: "([^"]*)")?/;

export const isSafe = (label: string) => label.length > 0 && !FORBIDDEN.test(label);

export const fingerprint = (s: Snapshot) =>
  `${new URL(s.url).pathname}|${s.candidates
    .map((c) => c.name)
    .sort()
    .join(',')
    .slice(0, 200)}`;

const parseAria = (yaml: string, frameIndex: number, seed: number): Candidate[] => {
  const out: Candidate[] = [];

  for (const line of yaml.split('\n')) {
    const m = INTERACTIVE.exec(line);

    if (!m?.[2]) continue;
    const name = m[2].trim().slice(0, 80);

    if (!isSafe(name) || out.some((c) => c.name === name)) continue;

    out.push({ frame: frameIndex, index: seed + out.length, name, role: m[1] as Candidate['role'] });
  }

  return out;
};

// The PMM product tour and any modal render an overlay that swallows every click,
// which is how the first run spent 376 of 446 steps on one screen.
export const dismissOverlays = async (page: Page): Promise<boolean> => {
  const closers = [
    page.getByTestId('tour-close-button'),
    page.getByTestId('tour-end-tour-button'),
    page.locator('[role="dialog"] button[aria-label="Close"]'),
  ];
  let closed = false;

  for (const closer of closers) {
    const target = closer.first();

    if (await target.isVisible({ timeout: 500 }).catch(() => false)) {
      await target.click({ timeout: 2_000 }).catch(() => undefined);
      closed = true;
    }
  }

  if (!closed) await page.keyboard.press('Escape').catch(() => undefined);

  return closed;
};

export const snapshot = async (
  page: Page,
  visited: string[],
  errors: string[],
  failed: string[],
): Promise<Snapshot> => {
  const candidates: Candidate[] = [];
  let visibleText = '';

  for (const [frameIndex, frame] of page.frames().entries()) {
    // A modal owns the interaction while it is open, so it alone supplies the candidates.
    const dialog = frame.locator('[role="dialog"]').first();
    const modal = await dialog.isVisible({ timeout: 300 }).catch(() => false);
    const body = modal ? dialog : frame.locator('body');

    try {
      const [text, aria] = await Promise.all([
        body.innerText({ timeout: 5_000 }),
        body.ariaSnapshot({ timeout: 5_000 }),
      ]);

      visibleText += `${text.slice(0, MAX_TEXT)}\n`;
      candidates.push(...parseAria(aria, frameIndex, candidates.length));
    } catch {
      continue;
    }

    if (candidates.length >= MAX_CANDIDATES) break;
  }

  return {
    candidates: candidates.slice(0, MAX_CANDIDATES),
    consoleErrors: errors.slice(-5),
    failedRequests: failed.slice(-5),
    title: await page.title(),
    url: page.url(),
    visibleText: visibleText.slice(0, MAX_TEXT),
    visited: visited.slice(-30),
  };
};
