import { test, expect } from "@playwright/test";

/**
 * Skills, Tools, and Adapters page tests.
 * These follow the same card-based pattern, so they are grouped together.
 */

test.describe("Skills page", () => {
  test("shows page header", async ({ page }) => {
    await page.goto("/skills");
    await expect(
      page.getByRole("heading", { name: "Skills", level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/\d+ skill\(s\) available/)).toBeVisible({ timeout: 15_000 });
  });

  test("renders skill cards or empty state", async ({ page }) => {
    await page.goto("/skills");
    const description = await page.getByText(/\d+ skill\(s\) available/).textContent({ timeout: 10_000 });
    const count = parseInt(description?.match(/(\d+)/)?.[1] ?? "0", 10);

    if (count === 0) {
      await expect(page.getByRole("heading", { name: "No skills" })).toBeVisible();
    } else {
      const cards = page.locator("[data-slot='card']");
      await expect(cards.first()).toBeVisible();
    }
  });
});

test.describe("Tools page", () => {
  test("shows page header", async ({ page }) => {
    await page.goto("/tools");
    await expect(
      page.getByRole("heading", { name: "Tools", level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/\d+ tool\(s\) available/)).toBeVisible({ timeout: 15_000 });
  });

  test("renders tool cards or empty state", async ({ page }) => {
    await page.goto("/tools");
    const description = await page.getByText(/\d+ tool\(s\) available/).textContent({ timeout: 10_000 });
    const count = parseInt(description?.match(/(\d+)/)?.[1] ?? "0", 10);

    if (count === 0) {
      await expect(page.getByRole("heading", { name: "No tools" })).toBeVisible();
    } else {
      const cards = page.locator("[data-slot='card']");
      await expect(cards.first()).toBeVisible();
    }
  });
});

test.describe("Adapters page", () => {
  test("shows page header", async ({ page }) => {
    await page.goto("/adapters");
    await expect(
      page.getByRole("heading", { name: "Adapters", level: 1 })
    ).toBeVisible();
  });

  test("shows registered adapters section", async ({ page }) => {
    await page.goto("/adapters");
    await page.waitForLoadState("networkidle");

    // Should show either registered adapters or adapter configs
    const hasRegistered = await page.getByText("Registered Adapters").isVisible().catch(() => false);
    const hasEmpty = await page.getByText("No adapter configs").isVisible().catch(() => false);

    // At least one of these should be visible
    expect(hasRegistered || hasEmpty).toBeTruthy();
  });

  test("registered adapter has test button", async ({ page }) => {
    await page.goto("/adapters");
    await page.waitForLoadState("networkidle");

    const hasRegistered = await page.getByText("Registered Adapters").isVisible().catch(() => false);
    if (!hasRegistered) {
      test.skip();
      return;
    }

    // ConsoleAdapter should be registered by default
    await expect(page.getByRole("button", { name: /Test/i }).first()).toBeVisible();
  });
});
