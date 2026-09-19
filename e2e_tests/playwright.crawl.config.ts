import { PlaywrightTestConfig } from '@playwright/test';
import base from './playwright.config';

const config: PlaywrightTestConfig = {
  ...base,
  outputDir: './exploratory/findings/pw',
  reporter: [['list']],
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
