import { test, expect } from "@playwright/test";

/**
 * Tasks page tests.
 * Verifies kanban board columns and task display.
 */

test.describe("Tasks page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("shows page header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Tasks", level: 1 })
    ).toBeVisible();
  });

  test("shows kanban columns or empty state", async ({ page }) => {
    // Wait for data to load
    await page.waitForLoadState("networkidle");

    // Either shows the kanban board or the empty state
    const hasEmpty = await page.getByRole("heading", { name: "No tasks" }).isVisible().catch(() => false);

    if (hasEmpty) {
      await expect(page.getByText("No tasks found across any agents.")).toBeVisible();
    } else {
      // Kanban columns: pending, blocked, active, completed, failed
      const columns = ["pending", "blocked", "active", "completed", "failed"];
      for (const col of columns) {
        await expect(
          page.locator("h3").filter({ hasText: col })
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
