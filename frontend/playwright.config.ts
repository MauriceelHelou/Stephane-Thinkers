import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ...(process.env.CI ? [['github' as const]] : []),
  ],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Disable animations for consistent screenshots
    ...(process.env.CI ? {} : {}),
  },
  // Global setup and teardown
  globalSetup: './tests/config/global-setup.ts',
  globalTeardown: './tests/config/global-teardown.ts',
  projects: [
    // Main journey tests - chromium desktop
    {
      name: 'journeys',
      testMatch: /journeys\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    // Visual regression tests
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    // Mobile tests
    {
      name: 'mobile',
      testMatch: /.*mobile.*\.spec\.ts/,
      use: {
        ...devices['iPhone 12'],
      },
    },
    // Tablet tests
    {
      name: 'tablet',
      testMatch: /.*tablet.*\.spec\.ts/,
      use: {
        ...devices['iPad (gen 7)'],
      },
    },
    // Large desktop tests
    {
      name: 'large-desktop',
      testMatch: /.*large-desktop.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    // Legacy tests (existing test files)
    {
      name: 'chromium',
      testMatch: /(thinkers|connections|timeline|app)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // API integration tests (no browser needed)
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
