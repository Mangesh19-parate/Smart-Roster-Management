import { test, expect } from "@playwright/test"

test("placeholder test", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("text=Vite + React")).toBeVisible()
})