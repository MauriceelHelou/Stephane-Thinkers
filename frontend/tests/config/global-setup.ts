import { chromium, FullConfig } from '@playwright/test'

// 127.0.0.1 (not localhost): localhost resolves to IPv6 ::1 first on CI,
// but the backend (uvicorn --host 0.0.0.0) binds IPv4 only.
const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || 'http://127.0.0.1:8010'
const FRONTEND_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3010'

async function waitForServer(url: string, timeout: number = 60000): Promise<boolean> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return true
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  return false
}

async function globalSetup(config: FullConfig) {
  console.log('🚀 Running global setup...')

  // Check if backend is available
  console.log(`📡 Checking backend at ${API_URL}...`)
  const backendReady = await waitForServer(`${API_URL}/api/timelines/`)
  if (!backendReady) {
    console.warn('⚠️ Backend not available - tests may use mock data or fail')
  } else {
    console.log('✅ Backend is ready')
  }

  // Check if frontend is available
  console.log(`📡 Checking frontend at ${FRONTEND_URL}...`)
  const frontendReady = await waitForServer(FRONTEND_URL)
  if (!frontendReady) {
    throw new Error('Frontend server is not available. Please start it with `npm run dev`')
  }
  console.log('✅ Frontend is ready')

  // Launch browser to warm up
  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    // Pre-warm the application
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' })
    console.log('✅ Application pre-warmed')
  } catch (error) {
    console.warn('⚠️ Could not pre-warm application:', error)
  } finally {
    await browser.close()
  }

  console.log('🎉 Global setup complete')
}

export default globalSetup
