import { test, expect } from "@playwright/test";

const SOUL_CONTENT = "# Soul\n\nVoce e o analista de dados da Cia Cuidadores.";

test.describe("Agent Files Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/login");
    await page.getByRole("tab", { name: "Operador" }).click();
    await page.getByPlaceholder("Username").fill("cia");
    await page.getByPlaceholder("Senha").fill("(Cia@2026)");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/hub\/dashboard/, { timeout: 15_000 });
  });

  test("exibe apenas os 6 arquivos principais sem caminho", async ({ page }) => {
    await page.goto("/hub/agents/cia.analitico?tab=files&file=AGENT.md");

    for (const name of ["AGENT.md", "SOUL.md", "HEARTBEAT.md", "MEMORY.md", "CONVERSATION.md", "REQUEST.md"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    await expect(page.locator("button", { hasText: "conversations/" })).not.toBeVisible();
  });

  test("navega entre arquivos ao clicar nos toggles", async ({ page }) => {
    await page.goto("/hub/agents/cia.analitico?tab=files&file=AGENT.md");

    await page.getByRole("button", { name: "SOUL.md", exact: true }).click();
    await expect(page).toHaveURL(/file=SOUL\.md/);

    await page.getByRole("button", { name: "HEARTBEAT.md", exact: true }).click();
    await expect(page).toHaveURL(/file=HEARTBEAT\.md/);
  });

  test("exibe conteúdo renderizado em modo readonly (GET mockado)", async ({ page }) => {
    await page.route("**/agents/cia.analitico/files/SOUL.md", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ filename: "SOUL.md", content: SOUL_CONTENT }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/hub/agents/cia.analitico?tab=files&file=SOUL.md");

    // Em modo readonly: não há textarea, há o botão Editar e conteúdo renderizado
    await expect(page.getByRole("button", { name: /Editar/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("textarea")).not.toBeVisible();
    // Conteúdo markdown renderizado: o "# Soul" vira um h1
    await expect(page.locator("h1").filter({ hasText: "Soul" })).toBeVisible();
  });

  test("exibe empty state com botão Criar discreto na barra quando arquivo não existe", async ({ page }) => {
    await page.route("**/agents/cia.analitico/files/HEARTBEAT.md", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) });
      } else {
        route.continue();
      }
    });

    await page.goto("/hub/agents/cia.analitico?tab=files&file=HEARTBEAT.md");

    // Botão "Criar" na barra (topo direito), discreto
    await expect(page.getByRole("button", { name: /Criar/, exact: true })).toBeVisible({ timeout: 10_000 });

    // Empty state limpo — só ícone e texto, sem botão interno
    await expect(page.getByText("não existe para este agente")).toBeVisible();
    await expect(page.locator("textarea")).not.toBeVisible();

    // Sem botão "Criar de template" no corpo do empty state
    await expect(page.getByRole("button", { name: /template/ })).not.toBeVisible();
  });

  test("Criar — envia PUT com conteúdo do template e abre editor após criação", async ({ page }) => {
    const TEMPLATE = "# Heartbeat\n\nDescreve o comportamento periódico do agente.";
    let putBody: string | null = null;
    let getCallCount = 0;

    await page.route("**/agents/cia.analitico/files/HEARTBEAT.md", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        getCallCount++;
        // 1ª chamada: arquivo não existe; 2ª+ (após criação): retorna conteúdo
        if (getCallCount === 1) {
          route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) });
        } else {
          route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ filename: "HEARTBEAT.md", content: TEMPLATE }) });
        }
      } else if (method === "PUT") {
        putBody = await route.request().postData();
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "saved" }) });
      } else {
        route.continue();
      }
    });

    await page.route("**/agents/cia.analitico/templates/HEARTBEAT.md", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ filename: "HEARTBEAT.md", content: TEMPLATE }) });
    });

    await page.goto("/hub/agents/cia.analitico?tab=files&file=HEARTBEAT.md");

    // Empty state com botão Criar
    await expect(page.getByRole("button", { name: /Criar/, exact: true })).toBeVisible({ timeout: 10_000 });

    // Clica Criar
    await page.getByRole("button", { name: /Criar/, exact: true }).click();

    // PUT foi enviado com o conteúdo do template
    await expect.poll(() => putBody, { timeout: 5_000 }).not.toBeNull();
    expect(JSON.parse(putBody!)).toEqual({ content: TEMPLATE });

    // Após criação: editor abre em modo readonly com o conteúdo
    await expect(page.getByRole("button", { name: /Editar/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("h1").filter({ hasText: "Heartbeat" })).toBeVisible();
  });

  test("Criar sem template — envia PUT com conteúdo vazio", async ({ page }) => {
    let putBody: string | null = null;
    let getCallCount = 0;

    await page.route("**/agents/cia.analitico/files/REQUEST.md", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        getCallCount++;
        if (getCallCount === 1) {
          route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not found" }) });
        } else {
          route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ filename: "REQUEST.md", content: "" }) });
        }
      } else if (method === "PUT") {
        putBody = await route.request().postData();
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "saved" }) });
      } else {
        route.continue();
      }
    });

    // Template não existe para REQUEST.md
    await page.route("**/agents/cia.analitico/templates/REQUEST.md", (route) => {
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "no template" }) });
    });

    await page.goto("/hub/agents/cia.analitico?tab=files&file=REQUEST.md");

    await expect(page.getByRole("button", { name: /Criar/, exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Criar/, exact: true }).click();

    // PUT enviado com conteúdo vazio
    await expect.poll(() => putBody, { timeout: 5_000 }).not.toBeNull();
    expect(JSON.parse(putBody!)).toEqual({ content: "" });

    // Editor abre após criação
    await expect(page.getByRole("button", { name: /Editar/ })).toBeVisible({ timeout: 10_000 });
  });

  test("edita conteúdo de SOUL.md e recebe alerta de confirmação", async ({ page }) => {
    let putBody: string | null = null;
    let dialogMessage = "";

    // Auto-accept dialogs and capture message
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.route("**/agents/cia.analitico/files/SOUL.md", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ filename: "SOUL.md", content: SOUL_CONTENT }),
        });
      } else if (method === "PUT") {
        putBody = await route.request().postData();
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      } else {
        route.continue();
      }
    });

    await page.goto("/hub/agents/cia.analitico?tab=files&file=SOUL.md");

    // Espera modo readonly (botão Editar visível)
    await expect(page.getByRole("button", { name: /Editar/ })).toBeVisible({ timeout: 10_000 });

    // Entra em modo edição
    await page.getByRole("button", { name: /Editar/ }).click();

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await textarea.fill("# SOUL editado via teste\n\nConteúdo de teste Playwright.");

    await page.getByRole("button", { name: /Salvar/ }).click();

    // PUT foi enviado com o novo conteúdo
    await expect.poll(() => putBody, { timeout: 5_000 }).not.toBeNull();
    expect(JSON.parse(putBody!)).toEqual({ content: "# SOUL editado via teste\n\nConteúdo de teste Playwright." });

    // Após salvar: volta para modo readonly
    await expect(page.getByRole("button", { name: /Editar/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("textarea")).not.toBeVisible();

    // Alerta foi exibido com o nome do arquivo
    expect(dialogMessage).toContain("SOUL.md");
  });
});
