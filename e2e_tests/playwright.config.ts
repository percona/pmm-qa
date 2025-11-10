import { PlaywrightTestConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { Timeouts } from './helpers/timeouts';

dotenv.config({ quiet: true });
const pmmUrl = process.env.PMM_UI_URL ? process.env.PMM_UI_URL : 'http://localhost/';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  fullyParallel: true,
  timeout: Timeouts.TWO_MINUTES,
  globalTimeout: Timeouts.THIRTY_MINUTES,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
  use: {
    baseURL: pmmUrl,
    trace: 'on-first-retry',
    headless: (process.env.HEADLESS ?? 'true') === 'true',
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          args: ['--window-size=1920,1080'],
        },
      },
    },
  ],
};

export default config;
