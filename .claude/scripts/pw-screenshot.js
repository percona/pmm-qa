#!/usr/bin/env node
// Generic one-off screenshot helper for QA evidence — replaces Cursor's
// `playwright-cli` with the pre-installed Chromium directly.
//
// Usage:
//   node pw-screenshot.js <url> <output.png> [sessionId]
//
// If <sessionId> is given and .claude/scripts/.sessions/<sessionId>.json
// exists (written by pmm-ui-login.js), it is reused as the browser context's
// storage state so PMM pages stay logged in.
//
// For github.com pages (e.g. an Actions run on a private repo) this reuses
// whatever browser session already exists — same caveat as before: if the
// repo is private and no GitHub session is loaded, the page renders blank
// and you must sign in interactively first.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

async function main() {
  const [, , url, outputPath, sessionId] = process.argv;
  if (!url || !outputPath) {
    console.error(
      "usage: node pw-screenshot.js <url> <output.png> [sessionId]",
    );
    process.exit(1);
  }

  const width = Number(process.env.PMM_UI_WIDTH || 1920);
  const height = Number(process.env.PMM_UI_HEIGHT || 1080);

  const contextOpts = { ignoreHTTPSErrors: true, viewport: { width, height } };
  if (sessionId) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(sessionId)) {
      console.error(`invalid sessionId '${sessionId}' (letters, digits, '_', '-' only)`);
      process.exit(1);
    }
    const sessionsDir = path.join(__dirname, ".sessions");
    const storageStatePath = path.join(sessionsDir, `${sessionId}.json`);
    if (path.relative(sessionsDir, storageStatePath).startsWith("..")) {
      console.error(`invalid sessionId '${sessionId}': resolves outside .sessions/`);
      process.exit(1);
    }
    if (fs.existsSync(storageStatePath)) {
      contextOpts.storageState = storageStatePath;
    }
  }

  const browser = await chromium.launch();
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "networkidle" });
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });

  await browser.close();
  console.log(`Screenshot saved: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
