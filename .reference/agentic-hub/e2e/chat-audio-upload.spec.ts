import { test, expect } from "@playwright/test";

const AUDIO_FILE = "C:\\Users\\gugac\\Downloads\\Entrevista.mpeg";

test.describe("Chat — upload de áudio e transcrição", () => {
  test.setTimeout(300_000); // 5 min — áudio longo

  test("envia áudio via paperclip e recebe transcrição do agente", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // --- Login como Operador ---
    await page.goto("/hub/login");
    await page.getByRole("tab", { name: "Operador" }).click();
    await page.getByPlaceholder("Username").fill("cia");
    await page.getByPlaceholder("Senha").fill("(Cia@2026)");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/hub\/dashboard/, { timeout: 15_000 });

    // --- Navegar para Chat ---
    await page.goto("/hub/chat");

    // --- Selecionar agente cia.analitico ---
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "cia.analitico" }).click();
    await page.waitForURL(/\/hub\/chat\/cia\.analitico/, { timeout: 10_000 });

    // --- Criar nova conversa ---
    await page.getByRole("button", { name: /New Chat/i }).click();
    await page.waitForURL(/\/hub\/chat\/cia\.analitico\/.+/, { timeout: 15_000 });

    // --- Verificar que o input está visível ---
    await expect(page.locator("textarea")).toBeVisible();

    // --- Anexar arquivo via file chooser (click no paperclip) ---
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByTitle("Anexar arquivo").click(),
    ]);
    await fileChooser.setFiles(AUDIO_FILE);

    // Verificar que o pill do arquivo aparece
    await expect(page.getByText("Entrevista.mpeg")).toBeVisible({ timeout: 5_000 });

    // --- Preencher mensagem e enviar ---
    await page.locator("textarea").fill("Por favor transcreva esse áudio");
    await page.getByRole("button", { name: "Enviar" }).click();

    // --- Confirmar que o streaming começou (botão Parar aparece) ---
    await expect(page.getByRole("button", { name: "Parar" })).toBeVisible({ timeout: 30_000 });

    // --- Aguardar streaming terminar (botão Enviar reaparece — máx 4 min) ---
    await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible({ timeout: 240_000 });

    // --- Screenshot do resultado ---
    await page.screenshot({ path: "test-results/audio-transcription-result.png", fullPage: false });

    // --- Verificar resposta do assistente com texto da transcrição ---
    // [data-role="assistant"] é o último bubble do assistente
    const lastAssistantMsg = page.locator('[data-role="assistant"]').last();
    await expect(lastAssistantMsg).toBeVisible();
    const assistantText = await lastAssistantMsg.innerText();
    expect(assistantText.length).toBeGreaterThan(100); // tem conteúdo real

    // Conteúdo esperado da entrevista: "Boa tarde" ou "cuidador"
    expect(assistantText).toMatch(/Boa tarde|cuidador|transcrição|Entrevista/i);

    // --- Verificar ausência de erros críticos ---
    const criticalErrors = errors.filter(
      (e) => !e.includes("ResizeObserver") && !e.includes("favicon")
    );
    expect(criticalErrors, `Erros de console: ${criticalErrors.join(", ")}`).toHaveLength(0);
  });
});
