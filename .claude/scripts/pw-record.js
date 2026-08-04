#!/usr/bin/env node
// Screen recording for test evidence, using Playwright's own video capture
// (no "computer use", no external screen-recorder). Records a session
// while it navigates, dwells, then transcodes to .mp4 via ffmpeg (the
// .webm Playwright writes natively is otherwise a pain to view/attach).
//
// Usage:
//   node pw-record.js <url> <output.mp4> [sessionId] [dwellSeconds]
//
// If <sessionId> is given and a storage state from pmm-ui-login.js exists
// for it, the recording starts already logged in. <dwellSeconds> (default
// 15) is how long it sits on the page after load -- for anything more
// interactive than "load this page and capture it", copy this file and
// add real Playwright actions (clicks, fills, navigations) between goto()
// and the dwell; the video captures whatever the page does in between.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { chromium } = require("playwright");

const execFileAsync = promisify(execFile);

async function main() {
  const [, , url, outputPath, sessionId, dwellArg] = process.argv;
  if (!url || !outputPath) {
    console.error(
      "usage: node pw-record.js <url> <output.mp4> [sessionId] [dwellSeconds]",
    );
    process.exit(1);
  }
  const dwellSeconds = Number(dwellArg || 15);
  const width = Number(process.env.PMM_UI_WIDTH || 1920);
  const height = Number(process.env.PMM_UI_HEIGHT || 1080);

  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), "pmm-qa-recording-"));
  const contextOpts = {
    ignoreHTTPSErrors: true,
    viewport: { width, height },
    recordVideo: { dir: videoDir, size: { width, height } },
  };
  if (sessionId) {
    const storageStatePath = path.join(
      __dirname,
      ".sessions",
      `${sessionId}.json`,
    );
    if (fs.existsSync(storageStatePath)) {
      contextOpts.storageState = storageStatePath;
    }
  }

  const browser = await chromium.launch();
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(dwellSeconds * 1000);

  const video = page.video();
  await context.close();
  await browser.close();

  const webmPath = await video.path();
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      webmPath,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      outputPath,
    ]);
    fs.rmSync(videoDir, { recursive: true, force: true });
    console.log(`Recording saved: ${outputPath}`);
  } catch (err) {
    // ffmpeg missing or failed -- still hand back the raw webm rather than
    // losing the recording.
    const fallback = outputPath.replace(/\.mp4$/, ".webm");
    fs.copyFileSync(webmPath, fallback);
    fs.rmSync(videoDir, { recursive: true, force: true });
    console.error(`ffmpeg transcode failed (${err.message}); saved raw webm: ${fallback}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
