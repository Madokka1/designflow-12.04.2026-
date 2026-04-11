import { expect, test } from '@playwright/test'

test.describe('экран входа', () => {
  test('без сессии показывается заголовок входа', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /вход в приложение/i }),
    ).toBeVisible()
  })

  test('заголовок вкладки содержит Portfolio', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/portfolio/i)
  })
})
