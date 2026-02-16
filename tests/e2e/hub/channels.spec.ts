import { test, expect } from "@playwright/test";

/**
 * Channels page tests.
 * Verifies channel listing and empty state.
 */

test.describe("Channels page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/channels");
  });

  test("shows page header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Channels", level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/\d+ channel\(s\)/)).toBeVisible({ timeout: 15_000 });
  });

  test("renders channel cards or empty state", async ({ page }) => {
    const description = await page.getByText(/\d+ channel\(s\)/).textContent({ timeout: 10_000 });
    const count = parseInt(description?.match(/(\d+)/)?.[1] ?? "0", 10);

    if (count === 0) {
      await expect(page.getByRole("heading", { name: "No channels" })).toBeVisible();
      await expect(page.getByText("No channels configured yet.")).toBeVisible();
    } else {
      const cards = page.locator("[data-slot='card']");
      await expect(cards.first()).toBeVisible();

      // Cards show listener count
      await expect(page.getByText(/\d+ listeners/).first()).toBeVisible();
    }
  });
});
