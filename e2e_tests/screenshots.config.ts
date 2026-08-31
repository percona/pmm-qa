import { PlaywrightTestConfig } from '@playwright/test';
import baseConfig from './playwright.config';
import { Timeouts } from './helpers/timeouts';

const config: PlaywrightTestConfig = {
  ...baseConfig,
  projects: [
    {
      name: 'screenshots-setup',
      testDir: './tests/standalone',
      testMatch: /screenshots\.global-setup\.ts/,
      use: {
        actionTimeout: Timeouts.TEN_SECONDS,
        launchOptions: { args: ['--window-size=1920,1080'] },
        navigationTimeout: Timeouts.THIRTY_SECONDS,
      },
    },
    {
      dependencies: ['screenshots-setup'],
      name: 'screenshots',
      testDir: './tests/standalone',
      testMatch: /captureDashboardScreenshots\.test\.ts/,
      use: {
        actionTimeout: Timeouts.THIRTY_SECONDS,
        launchOptions: { args: ['--window-size=1920,1080'] },
        navigationTimeout: Timeouts.ONE_MINUTE,
      },
    },
  ],
  workers: 2,
};

export default config;
