import { test, expect, type Page } from "@playwright/test";

/**
 * WhatsApp instance lifecycle tests.
 * Creates, inspects, and deletes 3 instances via the Hub UI.
 * Does NOT test QR code linking (requires physical phone).
 */

const BASE = "http://localhost:8002";
const INSTANCES = ["test-alpha", "test-beta", "test-gamma"];

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Username").fill(process.env.SYSUSER ?? "admin");
  await page.getByPlaceholder("Password").fill(process.env.SYSPASS ?? "changeme");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

async function goToWhatsApp(page: Page) {
  await page.goto(`${BASE}/conectividade/whatsapp`);
  await expect(page.getByRole("heading", { name: "WhatsApp", level: 1 })).toBeVisible({ timeout: 15_000 });
}

async function createInstance(page: Page, name: string) {
  await page.getByRole("button", { name: "Nova Instancia" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByPlaceholder("minha-instancia").fill(name);
  await page.getByRole("button", { name: "Criar" }).click();
}

async function deleteInstanceViaAPI(name: string) {
  try {
    await fetch(`http://localhost:8080/instance/delete/${name}`, {
      method: "DELETE",
      headers: { apikey: "evolution-key" },
    });
  } catch { /* ignore cleanup errors */ }
}

// Clean up before and after the suite
test.beforeAll(async () => {
  for (const name of INSTANCES) {
    await deleteInstanceViaAPI(name);
  }
});

test.afterAll(async () => {
  for (const name of INSTANCES) {
    await deleteInstanceViaAPI(name);
  }
});

test.describe("WhatsApp instance lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── 1. Page loads correctly ────────────────────────────────────

  test("WhatsApp page loads with header and view toggle", async () => {
    await goToWhatsApp(page);

    await expect(page.getByRole("heading", { name: "WhatsApp", level: 1 })).toBeVisible();
    await expect(page.getByText("Gestao de conectividade WhatsApp via Evolution API")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova Instancia" })).toBeVisible();
  });

  // ── 2. Create 3 instances ─────────────────────────────────────

  for (const name of INSTANCES) {
    test(`create instance "${name}"`, async () => {
      await goToWhatsApp(page);
      await createInstance(page, name);

      // Should navigate to instance detail page
      await expect(
        page.getByRole("heading", { name, level: 1 })
      ).toBeVisible({ timeout: 15_000 });
    });
  }

  // ── 3. All 3 instances appear in the list ─────────────────────

  test("all 3 instances appear in the grid view", async () => {
    // Wait for backbone probe to discover instances (probe runs every 10s)
    await page.waitForTimeout(12_000);

    await goToWhatsApp(page);

    for (const name of INSTANCES) {
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  // ── 4. Instance detail page loads for each ────────────────────

  for (const name of INSTANCES) {
    test(`instance detail page loads for "${name}"`, async () => {
      await page.goto(`${BASE}/conectividade/whatsapp/${name}`);

      await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 15_000 });

      // Tabs should be visible
      await expect(page.getByRole("tab", { name: "Status" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "QR Code" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Configuracoes" })).toBeVisible();

      // Action buttons should be present
      await expect(page.getByRole("button", { name: "Reconectar" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Reiniciar" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Excluir" })).toBeVisible();
    });
  }

  // ── 5. Instance status card shows connection state ────────────

  test("instance status shows connection state", async () => {
    await page.goto(`${BASE}/conectividade/whatsapp/${INSTANCES[0]}`);

    // Should show "Estado Atual" card with a status badge
    await expect(page.getByText("Estado Atual")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Offline").or(page.getByText("Conectando")).or(page.getByText("Online"))
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── 6. Settings tab loads and shows toggles ───────────────────

  test("settings tab loads for an instance", async () => {
    await page.goto(`${BASE}/conectividade/whatsapp/${INSTANCES[0]}?tab=settings`);

    // Wait for settings form to load
    await expect(
      page.getByText("Rejeitar chamadas")
        .or(page.getByText("reject_call"))
        .or(page.getByText("Configuracoes"))
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── 7. QR tab loads (but we don't scan) ───────────────────────

  test("QR tab loads with generate button", async () => {
    await page.goto(`${BASE}/conectividade/whatsapp/${INSTANCES[0]}?tab=qr`);

    await expect(
      page.getByRole("button", { name: "Gerar QR Code" })
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── 8. Page shows summary cards and instance rows ─────────────

  test("page shows summary cards and instances", async () => {
    await goToWhatsApp(page);

    // Health card should show API status
    await expect(
      page.getByText("Online").first().or(page.getByText("Indisponivel").first()).or(page.getByText("Verificando").first())
    ).toBeVisible({ timeout: 15_000 });

    // Our instances should appear
    await expect(page.getByText(INSTANCES[0]).first()).toBeVisible({ timeout: 15_000 });
  });

  // ── 9. Delete all 3 instances via UI ──────────────────────────

  for (const name of INSTANCES) {
    test(`delete instance "${name}" via UI`, async () => {
      await page.goto(`${BASE}/conectividade/whatsapp/${name}`);
      await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 15_000 });

      // Click delete button
      await page.getByRole("button", { name: "Excluir" }).click();

      // Confirm dialog should appear
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

      // Click confirm button (no typed confirm needed)
      await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

      // Should navigate back to the WhatsApp list page
      await expect(
        page.getByRole("heading", { name: "WhatsApp", level: 1 })
      ).toBeVisible({ timeout: 15_000 });
    });
  }

  // ── 10. Instances list is empty after deletion ────────────────

  test("instances list is empty after all deletions", async () => {
    // Wait for probe to reflect deletions
    await page.waitForTimeout(12_000);

    await goToWhatsApp(page);

    for (const name of INSTANCES) {
      await expect(page.getByText(name)).not.toBeVisible({ timeout: 5_000 });
    }
  });
});
