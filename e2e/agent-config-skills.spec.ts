import { test, expect, type Page } from "@playwright/test";

const TEST_USER = process.env.TEST_USER ?? "guga.coder@gmail.com";
const TEST_PASS = process.env.TEST_PASS ?? "12345678";
const AGENT_ID = "guga.multicanal";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#username", TEST_USER);
  await page.fill("#password", TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });
}

async function waitForContent(page: Page) {
  await page.waitForFunction(
    () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
    { timeout: 15_000 },
  );
  await expect(page.getByRole("button", { name: /Preview/i }).first()).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Edit the content in the MarkdownEditor and wait for the autosave to confirm.
 * Uses fill() which is reliable with React-controlled textareas.
 */
async function editAndWaitForSave(page: Page, extraText = "x") {
  // Switch to edit mode
  await page.getByRole("button", { name: /Editar/i }).first().click();
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 5_000 });

  // Read current value
  const original = await textarea.inputValue();

  // Fill with original + extra char (triggers React onChange reliably)
  await textarea.fill(original + extraText);

  // Wait for autosave (debounce is 2s, then API call, then "Salvo" for 3s)
  await expect(page.getByText("Salvo").first()).toBeVisible({ timeout: 15_000 });

  // Restore original
  await textarea.fill(original);
  await expect(page.getByText("Salvo").first()).toBeVisible({ timeout: 15_000 });

  return original;
}

test.describe("Agent config - identity, conversation, heartbeat", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("identity: loads SOUL.md, content is visible, edit saves successfully", async ({ page }) => {
    await page.goto(`/agents/${AGENT_ID}/config?subtab=identity`);
    await waitForContent(page);

    // Preview mode: content should be rendered
    const previewPane = page.locator(".prose").first();
    await expect(previewPane).toBeVisible({ timeout: 5_000 });

    const content = await editAndWaitForSave(page);
    expect(content.length).toBeGreaterThan(0);
  });

  test("conversation: CONVERSATION.md loads editor and edit saves", async ({ page }) => {
    await page.goto(`/agents/${AGENT_ID}/config?subtab=conversation`);
    await waitForContent(page);

    await editAndWaitForSave(page);
  });

  test("heartbeat: HEARTBEAT.md loads editor and edit saves", async ({ page }) => {
    await page.goto(`/agents/${AGENT_ID}/config?subtab=heartbeat`);
    await waitForContent(page);

    await editAndWaitForSave(page);
  });
});

test.describe("Agent config - skills", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("skills: list loads and 'Nova skill' button is present", async ({ page }) => {
    await page.goto(`/agents/${AGENT_ID}/config?subtab=skills`);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
      { timeout: 15_000 },
    );

    await expect(page.getByRole("button", { name: /Nova skill/i })).toBeVisible({ timeout: 10_000 });
  });

  test("skills: create new skill and verify it appears in list", async ({ page }) => {
    await page.goto(`/agents/${AGENT_ID}/config?subtab=skills`);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("button", { name: /Nova skill/i })).toBeVisible({ timeout: 10_000 });

    const testSlug = `e2e-test-${Date.now()}`;
    const testName = `Skill E2E ${testSlug.slice(-6)}`;

    await page.getByRole("button", { name: /Nova skill/i }).click();

    // Form fields appear
    await expect(page.getByLabel("Slug")).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("Slug").fill(testSlug);
    await page.getByLabel("Nome").fill(testName);
    await page.getByLabel("Descrição").fill("Criada pelo teste automatizado");

    // Add content in editor
    await page.getByRole("button", { name: /Editar/i }).first().click();
    await page.locator("textarea").first().fill("# Skill E2E\n\nConteúdo de teste.");

    // Submit
    await page.getByRole("button", { name: /Criar skill/i }).click();

    // Returns to list with new skill visible
    await expect(page.getByRole("button", { name: /Nova skill/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(testName)).toBeVisible({ timeout: 5_000 });
  });

  test("skills: edit existing skill — content loads and saves", async ({ page }) => {
    await page.goto(`/agents/${AGENT_ID}/config?subtab=skills`);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("button", { name: /Nova skill/i })).toBeVisible({ timeout: 10_000 });

    const skillRows = page.locator(".divide-y > div");
    const count = await skillRows.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Open edit for first skill
    await skillRows.first().locator("button").first().click();

    // Edit form opens
    await expect(page.getByLabel("Nome")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /Voltar/i })).toBeVisible();

    // Edit content and verify autosave
    await page.getByRole("button", { name: /Editar/i }).first().click();
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    const original = await textarea.inputValue();
    await textarea.fill(original + "x");

    await expect(page.getByText("Salvo").first()).toBeVisible({ timeout: 15_000 });

    // Restore
    await textarea.fill(original);
    await expect(page.getByText("Salvo").first()).toBeVisible({ timeout: 15_000 });

    // Back to list
    await page.getByRole("button", { name: /Voltar/i }).click();
    await expect(page.getByRole("button", { name: /Nova skill/i })).toBeVisible({ timeout: 5_000 });
  });

  test("skills: create and then delete a skill", async ({ page }) => {
    await page.goto(`/agents/${AGENT_ID}/config?subtab=skills`);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("button", { name: /Nova skill/i })).toBeVisible({ timeout: 10_000 });

    const testSlug = `e2e-del-${Date.now()}`;
    const testName = `Del ${testSlug.slice(-8)}`;

    // Create
    await page.getByRole("button", { name: /Nova skill/i }).click();
    await expect(page.getByLabel("Slug")).toBeVisible({ timeout: 5_000 });
    await page.getByLabel("Slug").fill(testSlug);
    await page.getByLabel("Nome").fill(testName);
    await page.getByRole("button", { name: /Criar skill/i }).click();

    // Wait for it to appear
    await expect(page.getByText(testName)).toBeVisible({ timeout: 10_000 });

    // Find and click delete on the row containing this skill name
    const targetRow = page.locator(".divide-y > div").filter({ hasText: testName });
    await expect(targetRow).toBeVisible({ timeout: 5_000 });
    // Delete button is the second button (index 1)
    await targetRow.locator("button").nth(1).click();

    // Should disappear
    await expect(page.getByText(testName)).not.toBeVisible({ timeout: 5_000 });
  });
});
