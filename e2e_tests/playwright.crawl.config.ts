import { PlaywrightTestConfig } from '@playwright/test';
import base from './playwright.config';

const config: PlaywrightTestConfig = {
  ...base,
  // Playwright wipes outputDir on start, so each run needs its own or the previous video is lost.
  outputDir: `./exploratory/findings-${process.env.SWEEP_LABEL ?? 'crawl'}/pw`,
  reporter: [
    ['list'],
    [
      'html',
      { open: 'never', outputFolder: `./exploratory/findings-${process.env.SWEEP_LABEL ?? 'crawl'}/html` },
    ],
    ['junit', { outputFile: `./exploratory/findings-${process.env.SWEEP_LABEL ?? 'crawl'}/junit.xml` }],
  ],
  retries: 0,
  testDir: './exploratory',
  use: {
    ...base.use,
    video: { mode: 'on', size: { height: 800, width: 1_280 } },
    viewport: { height: 800, width: 1_280 },
  },
  workers: 1,
};

export default config;
