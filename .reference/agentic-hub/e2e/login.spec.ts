import { test, expect } from "@playwright/test";

test.describe("Hub Login — Usuário Cia (Laravel)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/login");
  });

  test("renders login page with tabs", async ({ page }) => {
    await expect(page.getByText("Backbone Hub")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Usuário Cia" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Operador" })).toBeVisible();
  });

  test("login with valid Laravel credentials redirects to dashboard", async ({ page }) => {
    // "Usuário Cia" tab is default
    await page.getByPlaceholder("seu@email.com").fill("guga.coder@gmail.com");
    await page.getByPlaceholder("Senha").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();

    await page.waitForURL(/\/hub\/dashboard/, { timeout: 15_000 });
  });

  test("login with invalid credentials shows error toast", async ({ page }) => {
    await page.getByPlaceholder("seu@email.com").fill("wrong@email.com");
    await page.getByPlaceholder("Senha").fill("wrongpassword");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Sonner toast with error
    await expect(page.locator("[data-sonner-toast][data-type='error']")).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Hub Login — Operador (Backbone)", () => {
  test("login with backbone credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/hub/login");

    // Switch to Operador tab
    await page.getByRole("tab", { name: "Operador" }).click();

    await page.getByPlaceholder("Username").fill("cia");
    await page.getByPlaceholder("Senha").fill("[Cia@2026]");
    await page.getByRole("button", { name: "Entrar" }).click();

    await page.waitForURL(/\/hub\/dashboard/, { timeout: 15_000 });
  });
});
