import { test, expect } from "@playwright/test";

/**
 * Conversations scroll test.
 * Mocks API responses to prove chat scrolls while sidebar stays fixed.
 */

const MOCK_SESSION_ID = "test-session-001";

const MOCK_CONVERSATIONS = [
  {
    session_id: MOCK_SESSION_ID,
    user_id: "guga",
    agent_id: "system.main",
    title: "Test conversation with long chat",
    created_at: "2026-02-14T13:49:02.000Z",
  },
  {
    session_id: "test-session-002",
    user_id: "guga",
    agent_id: "system.main",
    title: "Another conversation",
    created_at: "2026-02-14T12:00:00.000Z",
  },
];

// Generate enough messages to force scrolling
const MOCK_MESSAGES = Array.from({ length: 20 }, (_, i) => ({
  role: i % 2 === 0 ? "user" : "assistant",
  content:
    i % 2 === 0
      ? `User message ${i / 2 + 1}: Tell me more about topic ${i / 2 + 1}`
      : `This is a detailed response number ${Math.ceil(i / 2)}. `.repeat(8) +
        `\n\nHere are some key points:\n- Point A for message ${Math.ceil(i / 2)}\n- Point B with more details\n- Point C with even more context and explanation to make this message longer`,
}));

test.describe("Conversations — scroll proof", () => {
  test("chat scrolls up/down while sidebar stays fixed", async ({ page }) => {
    // Mock API responses
    await page.route("**/api/conversations", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_CONVERSATIONS),
        });
      } else {
        route.continue();
      }
    });

    await page.route(`**/api/conversations/${MOCK_SESSION_ID}/messages`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_MESSAGES),
      });
    });

    // Navigate to conversations page
    await page.goto("http://localhost:7700/conversations");
    await page.waitForLoadState("networkidle");

    // Wait for conversation list to render
    const listPanel = page.locator("div.w-72").first();
    await expect(listPanel).toBeVisible({ timeout: 10_000 });

    // Click the first conversation
    const firstEntry = listPanel.locator(".cursor-pointer, [class*='cursor-pointer']").first();
    await expect(firstEntry).toBeVisible({ timeout: 10_000 });
    await firstEntry.click();

    // Wait for messages to render
    await page.waitForTimeout(3_000);

    // Screenshot 1: initial state
    await page.screenshot({ path: "test-results/scroll-1-initial.png" });

    // Find the scroll viewport inside the chat area
    const chatViewport = page.locator(
      "div.flex-1.flex.flex-col.min-w-0 [data-slot='scroll-area-viewport']"
    );
    await expect(chatViewport).toBeVisible({ timeout: 5_000 });

    // Get sidebar position before
    const sidebarBefore = await listPanel.boundingBox();

    // Get scroll metrics
    const scrollHeight = await chatViewport.evaluate((el) => el.scrollHeight);
    const clientHeight = await chatViewport.evaluate((el) => el.clientHeight);
    const scrollTopInitial = await chatViewport.evaluate((el) => el.scrollTop);

    console.log(`scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, scrollTop=${scrollTopInitial}`);
    console.log(`isScrollable=${scrollHeight > clientHeight}`);

    // Assert content is actually scrollable
    expect(scrollHeight, "Content must be taller than viewport").toBeGreaterThan(clientHeight);

    // Scroll to the very top
    await chatViewport.evaluate((el) => el.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(500);

    const scrollTopAtTop = await chatViewport.evaluate((el) => el.scrollTop);
    console.log(`scrollTop at top: ${scrollTopAtTop}`);
    expect(scrollTopAtTop).toBe(0);

    // Screenshot 2: at the top — content should be different from initial
    await page.screenshot({ path: "test-results/scroll-2-at-top.png" });

    // Scroll to the bottom
    await chatViewport.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(500);

    const scrollTopAtBottom = await chatViewport.evaluate((el) => el.scrollTop);
    console.log(`scrollTop at bottom: ${scrollTopAtBottom}`);
    expect(scrollTopAtBottom).toBeGreaterThan(0);

    // Screenshot 3: at the bottom
    await page.screenshot({ path: "test-results/scroll-3-at-bottom.png" });

    // Prove the sidebar didn't move
    const sidebarAfter = await listPanel.boundingBox();
    expect(sidebarAfter!.y).toBe(sidebarBefore!.y);
    expect(sidebarAfter!.height).toBe(sidebarBefore!.height);

    console.log("PASS: Chat scrolled from top to bottom. Sidebar stayed fixed.");
  });
});
