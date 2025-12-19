import { defineConfig, devices } from '@playwright/test'

/**
 * CI-specific Playwright configuration
 * Optimized for parallel execution in GitHub Actions
 */
export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: true, // Fail if test.only is left in code
  retries: 2, // Retry failed tests twice in CI
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['blob'], // For sharded test merging
    ['html', { open: 'never', outputFolder: '../playwright-report' }],
    ['json', { outputFile: '../test-results.json' }],
    ['github'], // GitHub Actions annotations
    ['./reporters/custom-reporter.ts'], // Custom reporter for metrics
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  timeout: 60000, // 60 second timeout per test

  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: 'disabled',
    },
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },

  projects: [
    // Setup project - runs database reset and seeding
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    // Chrome - Primary browser for E2E tests
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
    },

    // Firefox - Secondary browser for cross-browser testing
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      grep: /@cross-browser/,
    },

    // Mobile Chrome - Responsive tests
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
      dependencies: ['setup'],
      grep: /@mobile|@responsive/,
    },

    // Tablet - Tablet-specific tests
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11'],
      },
      dependencies: ['setup'],
      grep: /@tablet|@responsive/,
    },
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./global.setup.ts'),
  globalTeardown: require.resolve('./global.teardown.ts'),

  // Output directory for test artifacts
  outputDir: '../test-results/',

  // Snapshot directory for visual regression
  snapshotDir: './visual/__snapshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}',

  // Web server configuration for local development
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'cd ../backend && uvicorn app.main:app --port 8001',
          url: 'http://localhost:8001/api/health',
          reuseExistingServer: true,
          timeout: 120000,
        },
        {
          command: 'npm run dev',
          url: 'http://localhost:3001',
          reuseExistingServer: true,
          timeout: 120000,
        },
      ],
})
