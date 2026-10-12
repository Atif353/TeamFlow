import { expect, type Page } from '@playwright/test'
import { PASSWORD, type Account } from './api'

export async function signIn(page: Page, account: Pick<Account, 'email'>) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

export async function completeVerification(page: Page) {
  await expect(page).toHaveURL(/\/verify-email/)
  const hint = await page.getByText(/development code is/i).innerText()
  const code = /(\d{6})/.exec(hint)?.[1] ?? ''
  await page.getByLabel('Digit 1 of 6').click()
  await page.keyboard.type(code)
  await expect(page).toHaveURL(/\/dashboard/)
}
