import { Page } from '@playwright/test'

const E2E_AUTH_TOKEN = 'e2e-auth-token'

/**
 * Prime sessionStorage before navigation so tests land in the app shell
 * instead of the password gate.
 */
export async function primeAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript((token: string) => {
    window.sessionStorage.setItem('auth_token', token)
    window.sessionStorage.setItem('authenticated', 'true')
    window.sessionStorage.setItem('quiz_popup_shown', 'true')
  }, E2E_AUTH_TOKEN)
}
