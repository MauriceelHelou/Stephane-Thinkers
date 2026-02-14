import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : 4,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ...(isCI ? [['github' as const]] : []),
  ],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Disable animations for consistent screenshots
    ...(isCI ? {} : {}),
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
    command: isCI
      ? `node -e "require('fs').rmSync('.next',{recursive:true,force:true})" && npx next dev --turbo -p 3010`
      : 'npx next dev --turbo -p 3010',
    url: 'http://localhost:3010',
    reuseExistingServer: !isCI,
    timeout: isCI ? 180000 : 120000,
  },
})
