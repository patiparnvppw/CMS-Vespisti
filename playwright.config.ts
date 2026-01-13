import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * Environment configuration
 */
const ENV = process.env.ENV || 'dev';

const environments = {
  dev: {
    baseURL: process.env.BASE_URL || 'https://vespistiid-backend-dev.vespiario.net/',
    username: process.env.TEST_USERNAME || 'test@vespiario.net',
    password: process.env.TEST_PASSWORD || 'T12345678',
  },
  uat: {
    baseURL: process.env.BASE_URL || 'https://uat.cms-vespisti.com',
    username: process.env.TEST_USERNAME || 'test@vespiario.net',
    password: process.env.TEST_PASSWORD || 'T12345678',
  },
  prod: {
    baseURL: process.env.BASE_URL || 'https://cms-vespisti.com',
    username: process.env.TEST_USERNAME || 'test@vespiario.net',
    password: process.env.TEST_PASSWORD || 'T12345678',
  },
};

const currentEnv = environments[ENV as keyof typeof environments] || environments.dev;

console.log(`🚀 Running tests on ${ENV.toUpperCase()} environment: ${currentEnv.baseURL}`);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: currentEnv.baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',

    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'X-Environment': ENV,
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
