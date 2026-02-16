import { test, expect } from "@playwright/test";

/**
 * Conversations admin page tests.
 * Verifies session listing, message inspector, and delete flow.
 */

const API = "http://localhost:5174/api";

// Cleanup helper — removes test sessions
async function cleanupTestSessions(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get(`${API}/conversations`);
  if (!res.ok()) return;
  const sessions: { session_id: string; user_id: string }[] = await res.json();
  for (const s of sessions) {
    if (s.user_id === "e2e-hub-test") {
      await request.delete(`${API}/conversations/${s.session_id}`);
    }
  }
}

test.describe("Conversations page", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestSessions(request);
  });

  test("shows page header with count", async ({ page }) => {
    await page.goto("/conversations");
    await expect(
      page.getByRole("heading", { name: "Conversations", level: 1 })
    ).toBeVisible();
    await expect(page.getByText(/\d+ session\(s\)/)).toBeVisible({ timeout: 15_000 });
  });

  test("shows empty state when no conversations", async ({ page }) => {
    await page.goto("/conversations");
    const description = await page.getByText(/\d+ session\(s\)/).textContent({ timeout: 10_000 });
    const count = parseInt(description?.match(/(\d+)/)?.[1] ?? "0", 10);

    if (count === 0) {
      await expect(page.getByText("No conversations")).toBeVisible();
      await expect(page.getByText("No conversation sessions found.")).toBeVisible();
    }
  });

  test("conversation card shows inspect and delete actions", async ({ page, request }) => {
    // Create a test session via API
    await request.post(`${API}/conversations`, {
      data: { userId: "e2e-hub-test" },
    });

    await page.goto("/conversations");
    await page.waitForLoadState("networkidle");

    // Find a conversation card
    const card = page.locator("[data-slot='card']").first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Should have inspect (eye), download, and delete (trash) buttons
    const buttons = card.locator("button");
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(2); // at least inspect + delete
  });

  test("inspect button opens message dialog", async ({ page, request }) => {
    // Create a test session
    await request.post(`${API}/conversations`, {
      data: { userId: "e2e-hub-test" },
    });

    await page.goto("/conversations");
    await page.waitForLoadState("networkidle");

    // Click inspect button on first conversation
    const card = page.locator("[data-slot='card']").first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // The Eye icon button is the first action button
    const inspectBtn = card.locator("button").first();
    await inspectBtn.click();

    // Message Inspector dialog should open
    await expect(page.getByText("Message Inspector")).toBeVisible({ timeout: 5_000 });
  });

  test("delete conversation shows confirmation", async ({ page, request }) => {
    // Create a test session
    await request.post(`${API}/conversations`, {
      data: { userId: "e2e-hub-test" },
    });

    await page.goto("/conversations");
    await page.waitForLoadState("networkidle");

    const card = page.locator("[data-slot='card']").first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Click the trash (last) button
    const buttons = card.locator("button");
    const lastBtn = buttons.last();
    await lastBtn.click();

    // Confirmation dialog
    await expect(page.getByText("Delete Conversation")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("This will permanently delete this conversation.")).toBeVisible();

    // Confirm
    await page.getByRole("button", { name: "Delete" }).click();

    // Card should disappear or count should decrease
    await page.waitForLoadState("networkidle");
  });
});
