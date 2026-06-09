import { FullConfig } from '@playwright/test'

/**
 * Global teardown for Playwright tests
 * Runs once after all tests in the test suite
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  // 127.0.0.1 (not localhost): backend binds IPv4 only; localhost may resolve to ::1 on CI.
  const apiURL = process.env.API_BASE_URL || 'http://127.0.0.1:8010'

  console.log('\n🧹 Starting global test teardown...')

  // Clean up test data
  await cleanupTestData(apiURL)

  // Generate test summary
  await generateTestSummary()

  console.log('✅ Global teardown complete\n')
}

async function cleanupTestData(apiURL: string): Promise<void> {
  try {
    const response = await fetch(`${apiURL}/api/test/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.ok) {
      console.log('   ✓ Test data cleanup complete')
    } else {
      console.log('   ⚠ Cleanup endpoint not available (non-critical)')
    }
  } catch {
    console.log('   ⚠ Could not cleanup test data')
  }
}

async function generateTestSummary(): Promise<void> {
  console.log('   ✓ Test summary will be available in playwright-report/')
}

export default globalTeardown
