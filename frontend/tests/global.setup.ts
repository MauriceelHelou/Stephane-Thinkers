import { FullConfig } from '@playwright/test'

/**
 * Global setup for Playwright tests
 * Runs once before all tests in the test suite
 */
async function globalSetup(config: FullConfig): Promise<void> {
  // 127.0.0.1 (not localhost): localhost resolves to IPv6 ::1 first on CI,
  // but the backend (uvicorn --host 0.0.0.0) binds IPv4 only.
  const baseURL = config.projects[0]?.use?.baseURL || 'http://127.0.0.1:3010'
  const apiURL = process.env.API_BASE_URL || 'http://127.0.0.1:8010'

  console.log('\n🚀 Starting global test setup...')
  console.log(`   Frontend URL: ${baseURL}`)
  console.log(`   API URL: ${apiURL}`)

  // Wait for services to be ready
  await waitForService(`${apiURL}/api/health`, 'Backend API')
  await waitForService(baseURL, 'Frontend')

  // Reset database to known state
  await resetDatabase(apiURL)

  console.log('✅ Global setup complete\n')
}

async function waitForService(url: string, name: string, timeout = 60000): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok) {
        console.log(`   ✓ ${name} is ready`)
        return
      }
    } catch {
      // Service not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error(`${name} did not become ready within ${timeout}ms`)
}

async function resetDatabase(apiURL: string): Promise<void> {
  try {
    // Call reset endpoint if available
    const response = await fetch(`${apiURL}/api/test/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.ok) {
      console.log('   ✓ Database reset complete')
    } else {
      console.log('   ⚠ Database reset endpoint not available (non-critical)')
    }
  } catch (error) {
    console.log('   ⚠ Could not reset database (tests may use their own reset)')
  }
}

export default globalSetup
