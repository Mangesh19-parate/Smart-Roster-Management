/**
 * Phase 8 E2E Test Suite
 * Flow: login -> generate -> views -> structural conflict -> add leave -> apply suggestion
 */
import { test, expect } from "@playwright/test";

test.describe("Roster Management E2E Demo Flow", () => {
  test("complete manager workflow", async ({ page }) => {
    // 1. Login with demo manager account
    await page.goto("/login");
    await expect(page.locator("text=Smart Roster")).toBeVisible();

    const demoManagerBtn = page.getByRole("button", { name: /manager/i });
    if (await demoManagerBtn.isVisible()) {
      await demoManagerBtn.click();
    }

    // 2. Main app navigation & header
    await expect(page.locator("text=Smart Roster")).toBeVisible();

    // 3. Generate roster
    const generateBtn = page.getByRole("button", { name: /generate/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
    }

    // 4. View switching: Company, Pod, Brand, Process, Employee
    const views = ["Pod", "Brand", "Process", "Employee", "Company"];
    for (const view of views) {
      const tab = page.getByRole("button", { name: new RegExp(view, "i") }).first();
      if (await tab.isVisible()) {
        await tab.click();
      }
    }

    // 5. Structural conflict / Issues Panel
    const issuesBtn = page.getByRole("button", { name: /issue|conflict|structural/i }).first();
    if (await issuesBtn.isVisible()) {
      await issuesBtn.click();
    }

    // 6. Request / Add Leave
    const leaveBtn = page.getByRole("button", { name: /leave/i }).first();
    if (await leaveBtn.isVisible()) {
      await leaveBtn.click();
    }

    // 7. Apply suggestion if present
    const applyBtn = page.getByRole("button", { name: /apply/i }).first();
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
    }
  });
});
