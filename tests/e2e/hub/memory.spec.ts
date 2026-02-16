import { test, expect } from "@playwright/test";

/**
 * Memory page tests.
 * Verifies agent selector, tabs, search, and operations.
 */

const API = "http://localhost:5174/api";

test.describe("Memory page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/memory");
  });

  test("shows page header", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Memory", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Semantic memory search and management")).toBeVisible();
  });

  test("shows agent selector dropdown", async ({ page }) => {
    await expect(page.getByText("Select agent...")).toBeVisible({ timeout: 10_000 });
  });

  test("selecting agent reveals tabs", async ({ page, request }) => {
    // Get agents from API
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    // Click the agent selector
    await page.getByText("Select agent...").click();

    // Select the first agent
    const agentId = agents[0].id;
    await page.getByRole("option", { name: agentId }).click();

    // Tabs should appear: Search, Browse Chunks, Operations
    await expect(page.getByRole("tab", { name: "Search" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("tab", { name: "Browse Chunks" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Operations" })).toBeVisible();
  });

  test("search tab has input and search button", async ({ page, request }) => {
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    await page.getByText("Select agent...").click();
    await page.getByRole("option", { name: agents[0].id }).click();

    await expect(page.getByPlaceholder("Search memory...")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Search/i })).toBeVisible();
  });

  test("operations tab has sync and reset buttons", async ({ page, request }) => {
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    await page.getByText("Select agent...").click();
    await page.getByRole("option", { name: agents[0].id }).click();

    await page.getByRole("tab", { name: "Operations" }).click();

    await expect(page.getByRole("button", { name: /Force Sync/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Reset Memory/i })).toBeVisible();
  });
});
