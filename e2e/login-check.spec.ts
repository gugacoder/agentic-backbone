import { test, expect } from "@playwright/test";

test("login and see app", async ({ page }) => {
  await page.goto("/login");

  // Should show login form
  await expect(page.locator("#username")).toBeVisible({ timeout: 10_000 });

  await page.fill("#username", "guga.coder@gmail.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');

  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });

  // Should see something in the authenticated area (not an error)
  await expect(page).not.toHaveURL(/login/);

  // Take a screenshot for verification
  await page.screenshot({ path: ".tmp/login-success.png" });

  console.log("Login successful! URL:", page.url());
});
