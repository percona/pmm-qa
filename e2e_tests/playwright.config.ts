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
        // headless: false,
        launchOptions: {
          args: ['--window-size=1920,1080'],
        },
        navigationTimeout: Timeouts.TEN_SECONDS,
      },
    },
    {
      name: 'screenshots-setup',
      testDir: './tests/standalone',
      testMatch: /screenshots\.global-setup\.ts/,
      use: {
        actionTimeout: Timeouts.TEN_SECONDS,
        launchOptions: {
          args: ['--window-size=1920,1080'],
        },
        navigationTimeout: Timeouts.THIRTY_SECONDS,
      },
    },
    {
      dependencies: ['screenshots-setup'],
      name: 'screenshots',
      testDir: './tests/standalone',
      testMatch: /captureDashboardScreenshots\.test\.ts/,
      use: {
        actionTimeout: Timeouts.TEN_SECONDS,
        launchOptions: {
          args: ['--window-size=1920,1080'],
        },
        navigationTimeout: Timeouts.THIRTY_SECONDS,
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
    trace: 'retain-on-first-failure',
    viewport: { height: 1_080, width: 1_920 },
  },
  workers: Number(process.env.WORKERS) || 1,
};

export default config;
