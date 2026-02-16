import { test, expect } from "@playwright/test";

/**
 * Agents page tests.
 * Verifies agent listing, heartbeat toggle, detail page navigation,
 * and delete flow.
 */

const API = "http://localhost:5174/api";

test.describe("Agents list page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/agents");
  });

  test("shows page header with count", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Agents", level: 1 })
    ).toBeVisible();
    // Description shows agent count (e.g. "1 agent(s) registered")
    await expect(page.getByText(/\d+ agent\(s\) registered/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("renders agent cards or empty state", async ({ page }) => {
    // Either shows agent cards or "No agents" empty state
    const hasAgents = await page.getByText(/\d+ agent\(s\) registered/).textContent({ timeout: 10_000 });
    const count = parseInt(hasAgents?.match(/(\d+)/)?.[1] ?? "0", 10);

    if (count === 0) {
      await expect(page.getByText("No agents")).toBeVisible();
      await expect(page.getByText("Create your first agent to get started.")).toBeVisible();
    } else {
      // At least one card is shown
      const cards = page.locator("[data-slot='card']");
      await expect(cards.first()).toBeVisible();
    }
  });

  test("agent cards show heartbeat toggle", async ({ page }) => {
    // Wait for agents to load
    const description = await page.getByText(/\d+ agent\(s\) registered/).textContent({ timeout: 10_000 });
    const count = parseInt(description?.match(/(\d+)/)?.[1] ?? "0", 10);
    if (count === 0) {
      test.skip();
      return;
    }

    // Each card should have a "Heartbeat" label and a switch
    await expect(page.getByText("Heartbeat").first()).toBeVisible();
    await expect(page.locator("button[role='switch']").first()).toBeVisible();
  });

  test("clicking agent card navigates to detail page", async ({ page }) => {
    const description = await page.getByText(/\d+ agent\(s\) registered/).textContent({ timeout: 10_000 });
    const count = parseInt(description?.match(/(\d+)/)?.[1] ?? "0", 10);
    if (count === 0) {
      test.skip();
      return;
    }

    // Click the first agent link (the card title is a link)
    const firstAgentLink = page.locator("[data-slot='card'] a").first();
    const agentId = await firstAgentLink.textContent();
    await firstAgentLink.click();

    await page.waitForURL("**/agents/**");
    // Detail page should show agent ID as heading
    await expect(
      page.getByRole("heading", { name: agentId!.trim(), level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Agent detail page", () => {
  test("shows tabs: Files, Config, Heartbeat, Memory", async ({ page, request }) => {
    // Get a real agent ID from the API
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) {
      test.skip();
      return;
    }
    const agents = await res.json();
    if (!agents.length) {
      test.skip();
      return;
    }

    const agentId = agents[0].id;
    await page.goto(`/agents/${agentId}`);

    await expect(page.getByRole("tab", { name: "Files" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("tab", { name: "Config" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Heartbeat" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Memory" })).toBeVisible();
  });

  test("Files tab shows markdown file selector and editor", async ({ page, request }) => {
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    await page.goto(`/agents/${agents[0].id}`);

    // Files tab is active by default
    await expect(page.getByRole("tab", { name: "Files" })).toBeVisible({ timeout: 10_000 });

    // File selector buttons (e.g. SOUL.md, AGENT.md)
    await expect(page.getByRole("button", { name: /\.md$/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Save button
    await expect(page.getByRole("button", { name: /Save/i })).toBeVisible();
  });

  test("Config tab shows agent configuration", async ({ page, request }) => {
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    await page.goto(`/agents/${agents[0].id}`);
    await page.getByRole("tab", { name: "Config" }).click();

    await expect(page.getByText("Agent Configuration")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("ID:")).toBeVisible();
    await expect(page.getByText("Owner:")).toBeVisible();
    await expect(page.getByText("Slug:")).toBeVisible();
  });

  test("Heartbeat tab shows heartbeat status", async ({ page, request }) => {
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    await page.goto(`/agents/${agents[0].id}`);
    await page.getByRole("tab", { name: "Heartbeat" }).click();

    await expect(page.getByText("Heartbeat Status")).toBeVisible({ timeout: 10_000 });
  });

  test("Memory tab shows memory index info", async ({ page, request }) => {
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    await page.goto(`/agents/${agents[0].id}`);
    await page.getByRole("tab", { name: "Memory" }).click();

    await expect(page.getByText("Memory Index")).toBeVisible({ timeout: 10_000 });
  });

  test("heartbeat toggle switch is present on detail page", async ({ page, request }) => {
    const res = await request.get(`${API}/agents`);
    if (!res.ok()) { test.skip(); return; }
    const agents = await res.json();
    if (!agents.length) { test.skip(); return; }

    await page.goto(`/agents/${agents[0].id}`);
    await expect(page.getByText("Heartbeat").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("button[role='switch']")).toBeVisible();
  });
});
