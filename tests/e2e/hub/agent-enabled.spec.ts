import { test, expect } from "@playwright/test";

/**
 * Tests for the agent enabled/disabled toggle.
 * Verifies both API and UI toggle behavior.
 */

const API = "http://localhost:7700/api";
const SYSUSER = "cia";
const SYSPASS = "[Cia@2026]";

let authToken: string;

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/auth/login`, {
    data: { username: SYSUSER, password: SYSPASS },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  authToken = body.token;
});

test.describe("Agent enabled toggle — API", () => {
  test("GET /agents returns enabled field", async ({ request }) => {
    const res = await request.get(`${API}/agents`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const agents = await res.json();
    expect(agents.length).toBeGreaterThan(0);

    for (const agent of agents) {
      expect(typeof agent.enabled).toBe("boolean");
    }
  });

  test("PATCH /agents/:id toggles enabled", async ({ request }) => {
    // Get current state
    const listRes = await request.get(`${API}/agents`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const agents = await listRes.json();
    const agent = agents[0];
    const originalEnabled = agent.enabled;

    // Toggle to opposite
    const patchRes = await request.patch(`${API}/agents/${agent.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { enabled: !originalEnabled },
    });
    const patchStatus = patchRes.status();
    const patchBody = await patchRes.json().catch(() => patchRes.text());
    console.log(`PATCH response: status=${patchStatus}, body=${JSON.stringify(patchBody)}`);
    expect(patchRes.ok()).toBeTruthy();
    const updated = await patchRes.json();
    expect(updated.enabled).toBe(!originalEnabled);

    // Verify persistence
    const verifyRes = await request.get(`${API}/agents/${agent.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const verified = await verifyRes.json();
    expect(verified.enabled).toBe(!originalEnabled);

    // Restore original state
    await request.patch(`${API}/agents/${agent.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { enabled: originalEnabled },
    });
  });
});

test.describe("Agent enabled toggle — UI", () => {
  test.beforeEach(async ({ page }) => {
    // Inject auth token into localStorage before navigating
    await page.goto("/login");
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem("hub-auth-token", token);
        localStorage.setItem("hub-auth-user", user);
        localStorage.setItem("hub-auth-role", "sysuser");
      },
      { token: authToken, user: SYSUSER }
    );
    await page.goto("/agents");
    // Wait for agents to load
    await expect(page.getByText(/\d+ agent\(s\) registered/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("switch elements are visible and clickable", async ({ page }) => {
    const switches = page.locator("button[role='switch']");
    const count = await switches.count();
    console.log(`Found ${count} switch(es) on the page`);
    expect(count).toBeGreaterThan(0);

    const firstSwitch = switches.first();
    await expect(firstSwitch).toBeVisible();
    await expect(firstSwitch).toBeEnabled();

    // Log switch attributes for debugging
    const attrs = await firstSwitch.evaluate((el) => ({
      disabled: el.hasAttribute("disabled"),
      ariaDisabled: el.getAttribute("aria-disabled"),
      ariaChecked: el.getAttribute("aria-checked"),
      dataState: el.getAttribute("data-state"),
      pointerEvents: getComputedStyle(el).pointerEvents,
      opacity: getComputedStyle(el).opacity,
      className: el.className,
    }));
    console.log("First switch attributes:", JSON.stringify(attrs, null, 2));
  });

  test("clicking enabled switch toggles agent state", async ({ page }) => {
    // Find the first card and its switch
    const cards = page.locator("[data-slot='card']");
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    // Get all switches in the first card
    const cardSwitches = firstCard.locator("button[role='switch']");
    const switchCount = await cardSwitches.count();
    console.log(`First card has ${switchCount} switch(es)`);

    // The enabled switch should be the first one
    const enabledSwitch = cardSwitches.first();
    const beforeState = await enabledSwitch.getAttribute("data-state");
    console.log(`Before click: data-state=${beforeState}`);

    // Click it
    await enabledSwitch.click();

    // Wait for state change (mutation + refetch)
    await page.waitForTimeout(2000);

    const afterState = await enabledSwitch.getAttribute("data-state");
    console.log(`After click: data-state=${afterState}`);

    // State should have changed
    expect(afterState).not.toBe(beforeState);

    // Click again to restore
    await enabledSwitch.click();
    await page.waitForTimeout(2000);
  });
});
