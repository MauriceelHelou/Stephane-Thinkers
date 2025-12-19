import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running global teardown...')

  // Cleanup any test artifacts or state if needed
  // In the future, this could reset the database to a clean state

  console.log('✅ Global teardown complete')
}

export default globalTeardown
