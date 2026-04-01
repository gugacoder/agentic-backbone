import { test, expect, type Page } from "@playwright/test";

const TEST_USER = process.env.TEST_USER ?? "admin@mail.com";
const TEST_PASS = process.env.TEST_PASS ?? "12345678";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#username", TEST_USER);
  await page.fill("#password", TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });
}

async function navigateToAdapters(page: Page) {
  await page.goto("/adapters");
  // Wait for loading skeletons to disappear
  await page.waitForFunction(
    () => {
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      return skeletons.length === 0;
    },
    { timeout: 10_000 },
  );
}

test.describe("Adapters page (/adapters)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1. Página carrega e exibe cabeçalho com botão Novo Adaptador", async ({ page }) => {
    await navigateToAdapters(page);

    // Button to create adapter should be visible
    await expect(page.getByRole("button", { name: /Novo Adaptador/i })).toBeVisible();

    // Filter buttons should be visible
    await expect(page.getByRole("button", { name: "Todos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "MySQL" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Evolution" })).toBeVisible();
  });

  test("2. Exibe cards de adaptadores ou estado vazio", async ({ page }) => {
    await navigateToAdapters(page);

    const cards = page.locator("[data-slot='card']");
    const emptyState = page.getByText("Nenhum adaptador encontrado");

    // Either cards or empty state should be visible
    const cardCount = await cards.count();
    if (cardCount > 0) {
      await expect(cards.first()).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

  test("3. Filtros de conector funcionam", async ({ page }) => {
    await navigateToAdapters(page);

    // Check initial state with "Todos" filter (already active)
    await expect(page.getByRole("button", { name: "Todos" })).toBeVisible();

    // Click MySQL filter
    await page.getByRole("button", { name: "MySQL" }).click();
    await page.waitForTimeout(300);
    // Page should still be functional
    await expect(page.getByRole("button", { name: /Novo Adaptador/i })).toBeVisible();

    // Click Evolution filter
    await page.getByRole("button", { name: "Evolution" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: /Novo Adaptador/i })).toBeVisible();

    // Return to Todos
    await page.getByRole("button", { name: "Todos" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: /Novo Adaptador/i })).toBeVisible();
  });

  test("4. Botão Novo Adaptador navega para /adapters/new e abre o Sheet", async ({ page }) => {
    await navigateToAdapters(page);

    await page.getByRole("button", { name: /Novo Adaptador/i }).click();

    // URL should change to /adapters/new
    await page.waitForURL("**/adapters/new", { timeout: 5_000 });

    // Sheet dialog should be visible
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Sheet title should say "Novo Adaptador" (use role=heading to be specific)
    await expect(page.getByRole("heading", { name: "Novo Adaptador" })).toBeVisible();
  });

  test("5. /adapters/new abre sheet diretamente via URL", async ({ page }) => {
    await page.goto("/adapters/new");

    // Wait for sheet to appear
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("heading", { name: "Novo Adaptador" })).toBeVisible();
  });

  test("6. Sheet de novo adaptador tem todos os campos obrigatórios", async ({ page }) => {
    await navigateToAdapters(page);
    await page.getByRole("button", { name: /Novo Adaptador/i }).click();
    await page.waitForURL("**/adapters/new");

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Should have connector select
    await expect(sheet.getByText("Conector")).toBeVisible();

    // Should have Name field
    await expect(sheet.getByLabel("Nome")).toBeVisible();

    // Should have Slug field
    await expect(sheet.getByLabel("Slug")).toBeVisible();

    // Should have Escopo select
    await expect(sheet.getByText("Escopo")).toBeVisible();

    // Should have Política select
    await expect(sheet.getByText("Política")).toBeVisible();

    // Should have Test and Save buttons
    await expect(sheet.getByRole("button", { name: /Testar conexão/i })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Salvar/i })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Cancelar/i })).toBeVisible();
  });

  test("7. Salvar botão habilitado mesmo sem testar (novo adaptador)", async ({ page }) => {
    await navigateToAdapters(page);
    await page.getByRole("button", { name: /Novo Adaptador/i }).click();
    await page.waitForURL("**/adapters/new");

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Fill label — slug should auto-generate
    await sheet.getByLabel("Nome").fill("Meu Teste");
    await page.waitForTimeout(300);

    // Slug should auto-generate as "meu-teste"
    const slugInput = sheet.getByLabel("Slug");
    await expect(slugInput).toHaveValue("meu-teste");

    // Save button should be ENABLED (not disabled) — no test required
    const saveBtn = sheet.getByRole("button", { name: /Salvar/i });
    await expect(saveBtn).toBeEnabled();
  });

  test("8. Slug é gerado automaticamente a partir do nome", async ({ page }) => {
    await navigateToAdapters(page);
    await page.getByRole("button", { name: /Novo Adaptador/i }).click();
    await page.waitForURL("**/adapters/new");

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    await sheet.getByLabel("Nome").fill("CRM MySQL Prod");
    await page.waitForTimeout(300);

    const slugInput = sheet.getByLabel("Slug");
    await expect(slugInput).toHaveValue("crm-mysql-prod");
  });

  test("9. Cancelar fecha o sheet e navega de volta para /adapters", async ({ page }) => {
    await navigateToAdapters(page);
    await page.getByRole("button", { name: /Novo Adaptador/i }).click();
    await page.waitForURL("**/adapters/new");

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Click cancel
    await sheet.getByRole("button", { name: /Cancelar/i }).click();

    // URL should return to /adapters
    await page.waitForURL("**/adapters", { timeout: 5_000 });

    // Sheet should be gone
    await expect(sheet).toBeHidden({ timeout: 3_000 });
  });

  test("10. Seletor de conector muda o formulário de credenciais", async ({ page }) => {
    await navigateToAdapters(page);
    await page.getByRole("button", { name: /Novo Adaptador/i }).click();
    await page.waitForURL("**/adapters/new");

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Default is MySQL — should see host, port, user, password fields
    await expect(sheet.getByLabel("Host")).toBeVisible();
    await expect(sheet.getByLabel("Usuário")).toBeVisible();

    // Switch to Evolution
    const connectorSelect = sheet.locator('[role="combobox"]').first();
    await connectorSelect.click();
    await page.getByRole("option", { name: "Evolution" }).click();
    await page.waitForTimeout(300);

    // Should show Evolution form (toggle "Personalizar servidor")
    await expect(sheet.getByText("Personalizar servidor")).toBeVisible();
    await expect(sheet.getByLabel("Nome da instância")).toBeVisible();

    // Switch to MCP
    await connectorSelect.click();
    await page.getByRole("option", { name: "MCP Server" }).click();
    await page.waitForTimeout(300);

    // Should show MCP form
    await expect(sheet.getByText("Configuração MCP")).toBeVisible();
    await expect(sheet.getByText("Transporte")).toBeVisible();
  });

  test("11. Card de adaptador existente tem toggle, botão testar e menu dropdown", async ({ page }) => {
    await navigateToAdapters(page);

    const cards = page.locator("[data-slot='card']");
    const cardCount = await cards.count();

    if (cardCount === 0) {
      test.skip(true, "No adapters to test");
      return;
    }

    const firstCard = cards.first();

    // Toggle switch should be present
    await expect(firstCard.locator('[role="switch"]')).toBeVisible();

    // Test button should be present
    await expect(firstCard.getByRole("button", { name: /Testar/i })).toBeVisible();

    // Dropdown menu trigger (3 dots) should be present
    const menuTrigger = firstCard.getByRole("button", { name: "Opções do adaptador" });
    await expect(menuTrigger).toBeVisible();
  });

  test("12. Menu de adaptador tem opções Editar e Remover", async ({ page }) => {
    await navigateToAdapters(page);

    const cards = page.locator("[data-slot='card']");
    const cardCount = await cards.count();

    if (cardCount === 0) {
      test.skip(true, "No adapters to test");
      return;
    }

    const firstCard = cards.first();

    // Open dropdown menu
    const menuTrigger = firstCard.getByRole("button", { name: "Opções do adaptador" });
    await menuTrigger.click();

    // Should see Editar and Remover options
    await expect(page.getByRole("menuitem", { name: /Editar/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Remover/i })).toBeVisible();
  });

  test("13. Editar adaptador abre sheet com dados preenchidos", async ({ page }) => {
    await navigateToAdapters(page);

    const cards = page.locator("[data-slot='card']");
    const cardCount = await cards.count();

    if (cardCount === 0) {
      test.skip(true, "No adapters to test");
      return;
    }

    const firstCard = cards.first();

    // Get adapter name from card
    const adapterName = await firstCard.locator("p.font-medium").first().textContent();

    // Open dropdown and click Edit
    const menuTrigger = firstCard.getByRole("button", { name: "Opções do adaptador" });
    await menuTrigger.click();
    await page.getByRole("menuitem", { name: /Editar/i }).click();

    // Sheet should open in edit mode
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Editar Adaptador", { exact: true })).toBeVisible();

    // Name field should be filled (use exact label to avoid matching "Nome da instância")
    if (adapterName) {
      await expect(sheet.getByLabel("Nome", { exact: true })).toHaveValue(adapterName.trim());
    }
  });

  test("14. Criar e remover adaptador (ciclo CRUD completo)", async ({ page }) => {
    await navigateToAdapters(page);

    const testSlug = `e2e-test-${Date.now()}`;
    const testName = `E2E Test Adapter ${Date.now()}`;

    // Open create sheet
    await page.getByRole("button", { name: /Novo Adaptador/i }).click();
    await page.waitForURL("**/adapters/new");

    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Fill name (slug auto-generates)
    await sheet.getByLabel("Nome").fill(testName);
    await page.waitForTimeout(300);

    // Override slug to our test slug
    const slugInput = sheet.getByLabel("Slug");
    await slugInput.fill(testSlug);

    // Connector: MySQL (default), fill host
    await sheet.getByLabel("Host").fill("localhost");

    // Save
    const saveBtn = sheet.getByRole("button", { name: /Salvar/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Sheet should close
    await expect(sheet).toBeHidden({ timeout: 10_000 });

    // Adapter should appear in the list
    await navigateToAdapters(page);
    await expect(page.getByText(testName)).toBeVisible({ timeout: 5_000 });

    // Find the new card and delete it
    const newCard = page.locator("[data-slot='card']").filter({ has: page.getByText(testName) });
    const menuTrigger = newCard.getByRole("button", { name: "Opções do adaptador" });
    await menuTrigger.click();
    await page.getByRole("menuitem", { name: /Remover/i }).click();

    // Should disappear from list
    await expect(page.getByText(testName)).toBeHidden({ timeout: 10_000 });
  });
});
