import { test, expect } from "@playwright/test";

/**
 * System page tests.
 * Verifies server info, environment status, context tree, and refresh action.
 */

test.describe("System page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/system");
  });

  test("shows page header with description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "System", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Server configuration and context management")).toBeVisible();
  });

  test("shows Refresh Registries button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Refresh Registries/i })
    ).toBeVisible();
  });

  test("Server Info card loads", async ({ page }) => {
    await expect(page.getByText("Server Info")).toBeVisible();

    // Should show version, node, platform, context dir
    await expect(page.getByText("Version:")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Node:")).toBeVisible();
    await expect(page.getByText("Platform:")).toBeVisible();
    await expect(page.getByText("Context Dir:")).toBeVisible();
  });

  test("Environment card loads", async ({ page }) => {
    await expect(page.getByText("Environment")).toBeVisible();

    // Should show env var keys with status badges
    // ANTHROPIC_API_KEY should be listed
    await expect(page.getByText("ANTHROPIC_API_KEY")).toBeVisible({ timeout: 15_000 });
  });

  test("Context Tree card loads", async ({ page }) => {
    await expect(page.getByText("Context Tree")).toBeVisible();

    // Tree should show directories (ends with /)
    await expect(page.locator("text=/\\w+\\//").first()).toBeVisible({ timeout: 15_000 });
  });

  test("Refresh Registries button is clickable", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Refresh Registries/i });
    await expect(btn).toBeEnabled();
    await btn.click();

    // Should not crash — button may briefly show disabled state
    await expect(btn).toBeEnabled({ timeout: 15_000 });
  });
});
