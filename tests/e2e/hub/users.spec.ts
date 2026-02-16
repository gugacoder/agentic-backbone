import { test, expect } from "@playwright/test";

/**
 * Users page tests.
 * Verifies user listing, create dialog, delete flow, and system user protection.
 */

const API = "http://localhost:5174/api";

// Cleanup helper — removes test users created during tests
async function cleanupTestUsers(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get(`${API}/users`);
  if (!res.ok()) return;
  const users: { slug: string }[] = await res.json();
  for (const u of users) {
    if (u.slug.startsWith("e2e-test-")) {
      await request.delete(`${API}/users/${u.slug}`);
    }
  }
}

test.describe("Users page", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestUsers(request);
  });

  test("shows page header with count", async ({ page }) => {
    await page.goto("/users");
    await expect(
      page.getByRole("heading", { name: "Users", level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/\d+ user\(s\)/)).toBeVisible({ timeout: 15_000 });
  });

  test("shows Add User button", async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("button", { name: /Add User/i })).toBeVisible();
  });

  test("create user flow", async ({ page }) => {
    await page.goto("/users");
    await page.waitForLoadState("networkidle");

    // Open create dialog
    await page.getByRole("button", { name: /Add User/i }).click();
    await expect(page.getByText("Create User")).toBeVisible();

    // Fill form
    const slug = `e2e-test-${Date.now()}`;
    await page.getByPlaceholder("Slug (e.g., john)").fill(slug);
    await page.getByPlaceholder("Display Name").fill("E2E Test User");

    // Submit
    await page.getByRole("button", { name: "Create" }).click();

    // User should appear in the list
    await expect(page.getByText("E2E Test User")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(slug)).toBeVisible();
  });

  test("system user cannot be deleted (no trash icon)", async ({ page }) => {
    await page.goto("/users");
    await page.waitForLoadState("networkidle");

    // Find the system user card
    const systemCard = page.locator("[data-slot='card']").filter({ hasText: "system" });

    // System user should not show a delete button (even on hover)
    await systemCard.hover();
    const trashButtons = systemCard.locator("button").filter({ has: page.locator("svg") });

    // The system card should not have a visible trash icon
    // (it's conditionally rendered only for non-system users)
    const count = await trashButtons.count();
    // system user has no delete button at all
    expect(count).toBe(0);
  });

  test("user cards show permissions", async ({ page }) => {
    await page.goto("/users");
    await page.waitForLoadState("networkidle");

    // Wait for cards to render
    const cards = page.locator("[data-slot='card']");
    const cardCount = await cards.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    // Each card shows Max agents, Create agents, Create channels
    await expect(page.getByText(/Max agents:/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Create agents:/i).first()).toBeVisible();
    await expect(page.getByText(/Create channels:/i).first()).toBeVisible();
  });

  test("delete user shows confirmation dialog", async ({ page, request }) => {
    // Create a test user via API first
    const slug = `e2e-test-${Date.now()}`;
    await request.post(`${API}/users`, {
      data: { slug, displayName: "Delete Test" },
    });

    await page.goto("/users");
    await page.waitForLoadState("networkidle");

    // Find the test user card and hover to reveal delete button
    const userCard = page.locator("[data-slot='card']").filter({ hasText: slug });
    await expect(userCard).toBeVisible({ timeout: 10_000 });
    await userCard.hover();

    // Click the trash button
    const trashBtn = userCard.locator("button").filter({ has: page.locator("svg") });
    await trashBtn.click();

    // Confirmation dialog should appear
    await expect(page.getByRole("heading", { name: "Delete User" })).toBeVisible();
    await expect(page.getByText(`Delete user ${slug}?`)).toBeVisible();

    // Confirm deletion
    await page.getByRole("button", { name: "Delete" }).click();

    // User should disappear from the list
    await expect(userCard).not.toBeVisible({ timeout: 10_000 });
  });
});
