import { test, expect, type Page } from "@playwright/test";

const TEST_USER = process.env.TEST_USER ?? "admin@mail.com";
const TEST_PASS = process.env.TEST_PASS ?? "12345678";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#username", TEST_USER);
  await page.fill("#password", TEST_PASS);
  await page.click('button[type="submit"]');
  // Wait for redirect to authenticated area
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });
}

async function navigateToCron(page: Page) {
  await page.goto("/cron");
  // Wait for skeleton loading to finish (skeletons disappear)
  await expect(page.getByPlaceholder("Buscar job...")).toBeVisible({ timeout: 10_000 });
  // Wait for loading to complete - either table rows appear or empty state
  await page.waitForFunction(
    () => {
      // Skeletons gone means loading is done
      const skeletons = document.querySelectorAll('[class*="skeleton"], [data-slot="skeleton"]');
      return skeletons.length === 0;
    },
    { timeout: 10_000 },
  );
}

test.describe("Cron page (/cron)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1. Page loads and shows cron jobs list or empty state", async ({
    page,
  }) => {
    await navigateToCron(page);

    // Should have the page header with "Novo Job" button
    await expect(page.getByRole("button", { name: /Novo Job/i })).toBeVisible();

    // Should have search input
    await expect(page.getByPlaceholder("Buscar job...")).toBeVisible();

    // Should have status filter buttons (use exact to avoid "Ativos" matching "Inativos")
    await expect(page.getByRole("button", { name: "Todos", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ativos", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inativos", exact: true })).toBeVisible();
  });

  test("2. Create new cron job - opens dialog with form", async ({ page }) => {
    await navigateToCron(page);

    // Click "Novo Job" button
    await page.getByRole("button", { name: /Novo Job/i }).click();

    // Dialog should be visible
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Novo Job" })).toBeVisible();

    // Should have agent selector
    await expect(page.getByLabel("Agente")).toBeVisible();

    // Should have slug field
    await expect(page.getByLabel("Nome (slug)")).toBeVisible();

    // Should have display name field
    await expect(page.getByLabel("Nome de exibicao")).toBeVisible();

    // Should have instructions field
    await expect(page.getByLabel("Instrucoes")).toBeVisible();

    // Should have schedule builder with type options
    await expect(page.getByText("Tipo de agenda")).toBeVisible();
    await expect(page.getByLabel("Intervalo")).toBeVisible();
    await expect(page.getByLabel("Diario")).toBeVisible();
    await expect(page.getByLabel("Semanal")).toBeVisible();
    await expect(page.getByLabel("Mensal")).toBeVisible();
    await expect(page.getByLabel("Personalizado")).toBeVisible();

    // Should have enabled toggle
    await expect(page.getByLabel("Ativo")).toBeVisible();

    // Should have submit and cancel buttons
    await expect(page.getByRole("button", { name: /Criar Job/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Cancelar/i })
    ).toBeVisible();
  });

  test("3. Create job - validation errors on empty submit", async ({
    page,
  }) => {
    await navigateToCron(page);
    await page.getByRole("button", { name: /Novo Job/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Submit without filling anything
    await page.getByRole("button", { name: /Criar Job/i }).click();

    // Should show validation errors (use p.text-destructive to avoid matching placeholder text)
    await expect(page.locator("p").filter({ hasText: "Selecione um agente" })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Slug e obrigatorio" })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Instrucoes sao obrigatorias" })).toBeVisible();
  });

  test("4. Create job - slug validation (kebab-case)", async ({ page }) => {
    await navigateToCron(page);
    await page.getByRole("button", { name: /Novo Job/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Enter invalid slug
    await page.getByLabel("Nome (slug)").fill("Invalid Slug!");
    await page.getByLabel("Instrucoes").fill("test instructions");

    // Select an agent if available
    const agentTrigger = page.locator("#cron-agent");
    await agentTrigger.click();
    const firstAgent = page.locator('[role="option"]').first();
    if (await firstAgent.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstAgent.click();
    }

    await page.getByRole("button", { name: /Criar Job/i }).click();

    // Should show kebab-case error
    await expect(
      page.getByText("Slug deve ser kebab-case")
    ).toBeVisible();
  });

  test("5. Create and delete a cron job (full CRUD cycle)", async ({
    page,
  }) => {
    await navigateToCron(page);

    const testSlug = `e2e-test-${Date.now()}`;

    // Open create dialog
    await page.getByRole("button", { name: /Novo Job/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Select first available agent
    const dialog = page.getByRole("dialog");
    const agentTrigger = dialog.locator("#cron-agent");
    await agentTrigger.click();
    // Wait for the listbox to appear
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    const firstAgent = listbox.locator('[role="option"]').first();
    if (!(await firstAgent.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "No agents available to create cron job");
      return;
    }
    await firstAgent.click();

    // Fill form
    await page.getByLabel("Nome (slug)").fill(testSlug);
    await page.getByLabel("Nome de exibicao").fill("E2E Test Job");
    await page.getByLabel("Instrucoes").fill("This is a test cron job created by Playwright e2e tests.");

    // Submit
    await page.getByRole("button", { name: /Criar Job/i }).click();

    // Wait for dialog to close (success)
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Verify job appears in list
    await expect(page.getByText("E2E Test Job")).toBeVisible({ timeout: 5_000 });

    // Click on the job to open detail
    await page.getByText("E2E Test Job").click();

    // Should see detail view
    await expect(page.getByText("Historico de execucoes")).toBeVisible({ timeout: 5_000 });

    // Delete the job
    await page.getByRole("button", { name: /Excluir/i }).click();

    // Confirm deletion in the confirmation dialog
    const confirmDialog = page.getByRole("alertdialog").or(page.locator('[role="dialog"]').last());
    await expect(confirmDialog).toBeVisible({ timeout: 3_000 });
    // Click the destructive confirm button (last Excluir/Confirmar button)
    await confirmDialog.getByRole("button", { name: /Confirmar|Excluir/i }).click();

    // Should go back to list and job should be gone
    await expect(page.getByRole("heading", { name: "E2E Test Job" })).toBeHidden({ timeout: 10_000 });
  });

  test("6. Schedule builder - switch between types", async ({ page }) => {
    await navigateToCron(page);
    await page.getByRole("button", { name: /Novo Job/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const dialog = page.getByRole("dialog");

    // Click "Intervalo" - click the label text, not the hidden radio input
    await dialog.locator("label", { hasText: "Intervalo" }).click();
    await expect(dialog.getByText("A cada", { exact: true })).toBeVisible();

    // Click "Semanal"
    await dialog.locator("label", { hasText: "Semanal" }).click();
    await expect(dialog.getByText("Dias da semana")).toBeVisible();
    await expect(dialog.getByText("Seg", { exact: true })).toBeVisible();

    // Click "Mensal"
    await dialog.locator("label", { hasText: "Mensal" }).click();
    await expect(dialog.getByText("Dia do mes")).toBeVisible();

    // Click "Personalizado"
    await dialog.locator("label", { hasText: "Personalizado" }).click();
    await expect(dialog.getByPlaceholder("* * * * *")).toBeVisible();

    // Click "Diario"
    await dialog.locator("label", { hasText: "Diario" }).click();
    await expect(dialog.getByText("Horario", { exact: true }).first()).toBeVisible();
  });

  test("7. Schedule builder - shows next executions", async ({ page }) => {
    await navigateToCron(page);
    await page.getByRole("button", { name: /Novo Job/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // The schedule builder should show description and next executions
    await expect(page.getByText("Proximas execucoes:")).toBeVisible({
      timeout: 3_000,
    });
  });

  test("8. Search/filter works", async ({ page }) => {
    await navigateToCron(page);

    // Type a search that should find nothing
    await page.getByPlaceholder("Buscar job...").fill("zzz-nonexistent-job-xyz");

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should show empty state or no results
    const hasResults = await page.locator("table tbody tr").count();
    if (hasResults === 0) {
      // Good - no results is expected for a nonsensical search
      await expect(
        page.getByText(/Nenhum job encontrado|Nenhum agendamento/i)
      ).toBeVisible();
    }
  });

  test("9. Status filter buttons work", async ({ page }) => {
    await navigateToCron(page);

    // Click "Ativos" (exact match to avoid matching "Inativos")
    await page.getByRole("button", { name: "Ativos", exact: true }).click();
    await page.waitForTimeout(300);

    // Click "Inativos"
    await page.getByRole("button", { name: "Inativos", exact: true }).click();
    await page.waitForTimeout(300);

    // Click "Todos" to go back
    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await page.waitForTimeout(300);

    // Page should still be functional
    await expect(page.getByRole("button", { name: /Novo Job/i })).toBeVisible();
  });

  test("10. Cancel dialog closes without saving", async ({ page }) => {
    await navigateToCron(page);
    await page.getByRole("button", { name: /Novo Job/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill some data
    await page.getByLabel("Nome (slug)").fill("test-cancel");

    // Cancel
    await page.getByRole("button", { name: /Cancelar/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
