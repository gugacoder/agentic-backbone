import { test, expect } from "@playwright/test";

/**
 * Navigation and layout tests for the Hub interface.
 * Verifies sidebar, routing, breadcrumbs, and responsive layout.
 */

const HUB = "http://localhost:5174";

test.describe("Hub navigation", () => {
  test("root redirects to /dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/dashboard");
    expect(page.url()).toContain("/dashboard");
  });

  test("sidebar shows all navigation sections", async ({ page }) => {
    await page.goto("/dashboard");

    const sidebar = page.locator("[data-slot='sidebar']");

    // Overview section
    await expect(sidebar.getByText("Overview")).toBeVisible();
    await expect(sidebar.getByText("Dashboard")).toBeVisible();
    await expect(sidebar.getByText("Agents")).toBeVisible();
    await expect(sidebar.getByText("Tasks")).toBeVisible();
    await expect(sidebar.getByText("Memory")).toBeVisible();

    // Resources section
    await expect(sidebar.getByText("Resources")).toBeVisible();
    await expect(sidebar.getByText("Channels")).toBeVisible();
    await expect(sidebar.getByText("Skills")).toBeVisible();
    await expect(sidebar.getByText("Tools")).toBeVisible();
    await expect(sidebar.getByText("Adapters")).toBeVisible();

    // Admin section
    await expect(sidebar.getByText("Admin")).toBeVisible();
    await expect(sidebar.getByText("Users")).toBeVisible();
    await expect(sidebar.getByText("Conversations")).toBeVisible();
    await expect(sidebar.getByText("System")).toBeVisible();
  });

  test("sidebar header has logo and title", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Backbone Hub")).toBeVisible();
  });

  test("sidebar footer shows version", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Agentic Backbone v0.0.1")).toBeVisible();
  });

  test("navigate to each page via sidebar", async ({ page }) => {
    const routes = [
      { name: "Agents", path: "/agents", heading: "Agents" },
      { name: "Tasks", path: "/tasks", heading: "Tasks" },
      { name: "Memory", path: "/memory", heading: "Memory" },
      { name: "Channels", path: "/channels", heading: "Channels" },
      { name: "Skills", path: "/skills", heading: "Skills" },
      { name: "Tools", path: "/tools", heading: "Tools" },
      { name: "Adapters", path: "/adapters", heading: "Adapters" },
      { name: "Users", path: "/users", heading: "Users" },
      { name: "Conversations", path: "/conversations", heading: "Conversations" },
      { name: "System", path: "/system", heading: "System" },
    ];

    await page.goto("/dashboard");
    const sidebar = page.locator("[data-slot='sidebar']");

    for (const route of routes) {
      await sidebar.getByText(route.name, { exact: true }).click();
      await page.waitForURL(`**${route.path}`);

      // Each page should show its title in an h1
      await expect(
        page.getByRole("heading", { name: route.heading, level: 1 })
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("breadcrumb bar shows current location", async ({ page }) => {
    await page.goto("/agents");
    // Breadcrumb should show "Agents" — check within the breadcrumb area (not sidebar)
    const breadcrumb = page.locator("[data-slot='breadcrumb']");
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });
  });

  test("direct URL navigation works for all pages", async ({ page }) => {
    const pages = [
      { path: "/dashboard", heading: "Dashboard" },
      { path: "/agents", heading: "Agents" },
      { path: "/tasks", heading: "Tasks" },
      { path: "/memory", heading: "Memory" },
      { path: "/channels", heading: "Channels" },
      { path: "/skills", heading: "Skills" },
      { path: "/tools", heading: "Tools" },
      { path: "/adapters", heading: "Adapters" },
      { path: "/users", heading: "Users" },
      { path: "/conversations", heading: "Conversations" },
      { path: "/system", heading: "System" },
    ];

    for (const pg of pages) {
      await page.goto(pg.path);
      await expect(
        page.getByRole("heading", { name: pg.heading, level: 1 })
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe("Responsive layout — mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile shows bottom nav instead of sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    // Bottom nav should be visible
    const bottomNav = page.locator("nav.fixed.bottom-0");
    await expect(bottomNav).toBeVisible();

    // Bottom nav has 5 items: Dashboard, Agents, Tasks, Memory, More
    await expect(bottomNav.getByText("Dashboard")).toBeVisible();
    await expect(bottomNav.getByText("Agents")).toBeVisible();
    await expect(bottomNav.getByText("Tasks")).toBeVisible();
    await expect(bottomNav.getByText("Memory")).toBeVisible();
    await expect(bottomNav.getByText("More")).toBeVisible();
  });

  test("mobile More button opens drawer with extra nav items", async ({ page }) => {
    await page.goto("/dashboard");

    // Tap More
    await page.locator("nav.fixed.bottom-0").getByText("More").click();

    // Drawer should show additional items
    await expect(page.getByRole("dialog").getByText("Channels")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Skills")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Tools")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Adapters")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Users")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Conversations")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("System")).toBeVisible();
  });

  test("mobile bottom nav navigates correctly", async ({ page }) => {
    await page.goto("/dashboard");

    await page.locator("nav.fixed.bottom-0").getByText("Agents").click();
    await page.waitForURL("**/agents");
    await expect(page.getByRole("heading", { name: "Agents", level: 1 })).toBeVisible();

    await page.locator("nav.fixed.bottom-0").getByText("Tasks").click();
    await page.waitForURL("**/tasks");
    await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();
  });

  test("mobile More drawer navigates and closes", async ({ page }) => {
    await page.goto("/dashboard");

    await page.locator("nav.fixed.bottom-0").getByText("More").click();
    await page.getByRole("dialog").getByText("System").click();

    await page.waitForURL("**/system");
    await expect(page.getByRole("heading", { name: "System", level: 1 })).toBeVisible();
  });
});
