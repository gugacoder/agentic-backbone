import { test, expect } from "@playwright/test";

test.describe("Docker staging smoke test", () => {
  const BASE = "http://localhost:6100";

  test("health endpoint responds 200", async ({ request }) => {
    const res = await request.get(`${BASE}/health`);
    expect(res.status()).toBe(200);
  });

  test("hub loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const res = await page.goto(`${BASE}/hub/`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);

    // Hub should have the title
    await expect(page).toHaveTitle(/Agentic Backbone/i);

    // Take screenshot
    await page.screenshot({ path: ".tmp/docker-hub.png", fullPage: true });

    // Filter out expected errors (SSE connection failures are normal without auth)
    const realErrors = errors.filter(
      (e) => !e.includes("401") && !e.includes("SSE") && !e.includes("EventSource") && !e.includes("net::ERR")
    );
    expect(realErrors).toEqual([]);
  });

  test("chat loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const res = await page.goto(`${BASE}/chat/`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);

    // Take screenshot
    await page.screenshot({ path: ".tmp/docker-chat.png", fullPage: true });

    const realErrors = errors.filter(
      (e) =>
        !e.includes("401") &&
        !e.includes("404") &&
        !e.includes("SSE") &&
        !e.includes("EventSource") &&
        !e.includes("net::ERR") &&
        !e.includes("Failed to load resource")
    );
    expect(realErrors).toEqual([]);
  });

  test("API health responds", async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/ai/health`);
    expect(res.status()).toBe(200);
  });

  test("root redirects to hub", async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: "commit" });
    await page.waitForURL(/\/hub\//);
    expect(page.url()).toContain("/hub/");
  });
});
