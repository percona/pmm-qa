import { PlaywrightTestConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { Timeouts } from '@helpers/timeouts';

dotenv.config({ override: true, quiet: true });

const pmmUrl = process.env.PMM_UI_URL ? process.env.PMM_UI_URL : 'http://localhost/';
const config: PlaywrightTestConfig = {
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  globalTimeout: Timeouts.THIRTY_MINUTES,
  projects: [
    {
      name: 'chromium',
      use: {
        actionTimeout: Timeouts.TEN_SECONDS,
        launchOptions: {
          args: ['--window-size=1920,1080'],
        },
      },
    },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './playwright-report' }],
    ['json', { outputFile: 'output/results.json' }],
  ],
  retries: process.env.CI ? 2 : 0,
  testDir: './tests',
  timeout: Timeouts.TEN_MINUTES,
  use: {
    baseURL: pmmUrl,
    headless: (process.env.HEADLESS ?? 'true') === 'true',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { height: 1_080, width: 1_920 },
  },
  workers: process.env.CI ? 4 : 1,
};

export default config;
