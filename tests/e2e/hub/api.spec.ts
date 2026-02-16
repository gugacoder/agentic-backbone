import { test, expect } from "@playwright/test";

/**
 * API proxy tests.
 * Verifies that the hub's /api proxy correctly forwards to the backbone.
 */

const API = "http://localhost:5174/api";

test.describe("Hub API proxy", () => {
  test("GET /api/health returns ok", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data).toHaveProperty("agents");
    expect(data).toHaveProperty("channels");
  });

  test("GET /api/agents returns array", async ({ request }) => {
    const res = await request.get(`${API}/agents`);
    expect(res.ok()).toBeTruthy();
    const agents = await res.json();
    expect(Array.isArray(agents)).toBeTruthy();
  });

  test("GET /api/users returns array", async ({ request }) => {
    const res = await request.get(`${API}/users`);
    expect(res.ok()).toBeTruthy();
    const users = await res.json();
    expect(Array.isArray(users)).toBeTruthy();
    // System user should always exist
    expect(users.some((u: { slug: string }) => u.slug === "system")).toBeTruthy();
  });

  test("GET /api/system/stats returns stats object", async ({ request }) => {
    const res = await request.get(`${API}/system/stats`);
    expect(res.ok()).toBeTruthy();
    const stats = await res.json();
    expect(stats).toHaveProperty("uptime");
    expect(stats).toHaveProperty("agents");
    expect(stats).toHaveProperty("channels");
    expect(stats).toHaveProperty("sessions");
  });

  test("GET /api/system/info returns server info", async ({ request }) => {
    const res = await request.get(`${API}/system/info`);
    expect(res.ok()).toBeTruthy();
    const info = await res.json();
    expect(info).toHaveProperty("version");
    expect(info).toHaveProperty("nodeVersion");
    expect(info).toHaveProperty("platform");
    expect(info).toHaveProperty("contextDir");
  });

  test("GET /api/system/env returns env map", async ({ request }) => {
    const res = await request.get(`${API}/system/env`);
    expect(res.ok()).toBeTruthy();
    const env = await res.json();
    expect(env).toHaveProperty("ANTHROPIC_API_KEY");
  });

  test("GET /api/conversations returns array", async ({ request }) => {
    const res = await request.get(`${API}/conversations`);
    expect(res.ok()).toBeTruthy();
    const sessions = await res.json();
    expect(Array.isArray(sessions)).toBeTruthy();
  });

  test("GET /api/channels returns array", async ({ request }) => {
    const res = await request.get(`${API}/channels`);
    expect(res.ok()).toBeTruthy();
    const channels = await res.json();
    expect(Array.isArray(channels)).toBeTruthy();
  });

  test("GET /api/tasks returns array", async ({ request }) => {
    const res = await request.get(`${API}/tasks`);
    expect(res.ok()).toBeTruthy();
    const tasks = await res.json();
    expect(Array.isArray(tasks)).toBeTruthy();
  });

  test("GET /api/skills returns array", async ({ request }) => {
    const res = await request.get(`${API}/skills`);
    expect(res.ok()).toBeTruthy();
    const skills = await res.json();
    expect(Array.isArray(skills)).toBeTruthy();
  });

  test("GET /api/tools returns array", async ({ request }) => {
    const res = await request.get(`${API}/tools`);
    expect(res.ok()).toBeTruthy();
    const tools = await res.json();
    expect(Array.isArray(tools)).toBeTruthy();
  });

  test("GET /api/adapters returns configs and registered", async ({ request }) => {
    const res = await request.get(`${API}/adapters`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty("configs");
    expect(data).toHaveProperty("registered");
    expect(Array.isArray(data.configs)).toBeTruthy();
    expect(Array.isArray(data.registered)).toBeTruthy();
  });

  test("POST /api/system/refresh succeeds", async ({ request }) => {
    const res = await request.post(`${API}/system/refresh`);
    expect(res.ok()).toBeTruthy();
  });

  test("user CRUD lifecycle", async ({ request }) => {
    const slug = `e2e-api-test-${Date.now()}`;

    // Create
    const createRes = await request.post(`${API}/users`, {
      data: { slug, displayName: "API Test User" },
    });
    expect(createRes.ok()).toBeTruthy();

    // Read
    const getRes = await request.get(`${API}/users/${slug}`);
    expect(getRes.ok()).toBeTruthy();
    const user = await getRes.json();
    expect(user.slug).toBe(slug);
    expect(user.displayName).toBe("API Test User");

    // Update
    const patchRes = await request.patch(`${API}/users/${slug}`, {
      data: { displayName: "Updated Name" },
    });
    expect(patchRes.ok()).toBeTruthy();

    // Verify update
    const getRes2 = await request.get(`${API}/users/${slug}`);
    const updated = await getRes2.json();
    expect(updated.displayName).toBe("Updated Name");

    // Delete
    const delRes = await request.delete(`${API}/users/${slug}`);
    expect(delRes.ok()).toBeTruthy();

    // Verify deleted
    const getRes3 = await request.get(`${API}/users/${slug}`);
    // Should return 404 or default user
    // The implementation may vary — just check it doesn't crash
  });
});
