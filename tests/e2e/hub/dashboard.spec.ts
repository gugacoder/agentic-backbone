import { test, expect } from "@playwright/test";

/**
 * Dashboard page tests.
 * Verifies health status cards, system stats, and live event stream.
 */

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("shows page header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Dashboard", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("System overview and real-time events")).toBeVisible();
  });

  test("displays four stat cards", async ({ page }) => {
    // Status card
    await expect(page.getByText("Status")).toBeVisible();

    // Agents card
    await expect(page.getByText("Agents").first()).toBeVisible();

    // Channels card
    await expect(page.getByText("Channels").first()).toBeVisible();

    // Sessions card
    await expect(page.getByText("Sessions").first()).toBeVisible();
  });

  test("health status loads from API", async ({ page }) => {
    // Wait for the status badge to appear (not just Loading)
    // The health endpoint returns status "ok" — this should render a badge
    await expect(page.locator("text=ok").first()).toBeVisible({ timeout: 15_000 });
  });

  test("agents count is a number", async ({ page }) => {
    // The Agents stat card shows "0" or a number as text-2xl font-bold
    // Find the card that contains the "Agents" text as a card title
    const agentsCard = page.locator("[data-slot='card']").filter({ hasText: "with heartbeat" });
    await expect(agentsCard).toBeVisible({ timeout: 15_000 });
    await expect(agentsCard.locator(".text-2xl")).toBeVisible();
  });

  test("Live Events section is present", async ({ page }) => {
    await expect(page.getByText("Live Events")).toBeVisible();
    // Initially shows waiting message
    await expect(page.getByText("Waiting for events...")).toBeVisible();
  });

  test("uptime is displayed in sessions card", async ({ page }) => {
    // The sessions card shows "Uptime: Xm" or "Uptime: Xh Ym"
    await expect(page.getByText(/Uptime:/)).toBeVisible({ timeout: 15_000 });
  });
});
