/**
 * E2E of the IP-only scan mode (NS-04): an authorized account picks "Solo con
 * la IP", scans without any stored credential and sees the mode in the history
 * and the unverified-patch notice in the report; an account without the
 * permission never sees the choice; a denylisted target gets a clear message;
 * axe finds no violations on the form and on the report.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function login(
  context: BrowserContext,
  email: string,
  canNetworkScan: boolean,
): Promise<void> {
  const response = await context.request.post("/__test__/session", {
    data: { email, name: "Analista E2E", can_network_scan: canNetworkScan },
  });
  expect(response.ok()).toBe(true);
}

async function expectNoAxeViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.length} node(s)`,
  );
  expect(summary, `axe on ${where}`).toEqual([]);
}

test.describe("account allowed to scan by IP", () => {
  test.beforeEach(async ({ context }) => {
    await login(context, "network-scan-allowed@example.test", true);
  });

  test("runs_an_ip_only_scan_and_sees_the_mode_and_the_notice", async ({
    page,
  }) => {
    await page.goto("/escanear");

    const group = page.getByRole("radiogroup", { name: "Modo de escaneo" });
    await expect(
      group.getByRole("radio", { name: "Con credenciales SSH" }),
    ).toBeChecked();
    await group.getByRole("radio", { name: "Solo con la IP" }).check();

    await expect(page.getByText(/Solo necesitas la IP/)).toBeVisible();
    await expectNoAxeViolations(page, "scan form, IP only");

    await page.getByLabel("IP a escanear").fill("192.0.2.10");
    await page.getByRole("button", { name: "Escanear" }).click();
    await expect(page.getByText(/escaneo en cola/i)).toBeVisible();
    // The contract server advances a scan only while someone listens to it.
    await expect(page.getByText(/Estado: Completado/)).toBeVisible();

    await page.goto("/historial");
    const row = page.locator("tr", { hasText: "192.0.2.10" });
    await expect(row).toContainText("Solo IP");
    await expect(row).toContainText("Completado");

    await row.getByRole("button", { name: /Ver reporte/ }).click();
    await expect(page.getByText("Modo de escaneo: Solo IP")).toBeVisible();
    await expect(page.getByRole("note")).toContainText(
      "Estado de parches no verificado",
    );
    await expectNoAxeViolations(page, "report of an IP-only scan");
  });

  test("a_denylisted_target_shows_a_clear_message", async ({ page }) => {
    await page.goto("/escanear");
    await page.getByRole("radio", { name: "Solo con la IP" }).check();

    await page.getByLabel("IP a escanear").fill("127.0.0.1");
    await page.getByRole("button", { name: "Escanear" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Esa IP es de loopback (127.0.0.0/8, ::1) y no se puede escanear.",
    );
  });

  test("the_ssh_mode_keeps_working_and_is_labelled_in_the_history", async ({
    page,
    context,
  }) => {
    const seeded = await context.request.post("/api/network-credentials", {
      data: {
        target_pattern: "172.16.70.3",
        network_user: "root",
        ssh_credentials_ref: "vault://ssh/e2e-lab-key",
        has_sudo: false,
      },
    });
    expect(seeded.ok()).toBe(true);
    await page.goto("/escanear");

    await page.getByLabel("Objetivo a escanear").selectOption("172.16.70.3");
    await page.getByRole("button", { name: "Escanear" }).click();
    await expect(page.getByText(/escaneo en cola/i)).toBeVisible();

    await page.goto("/historial");
    await expect(page.locator("tr", { hasText: "172.16.70.3" })).toContainText(
      "SSH",
    );
  });
});

test.describe("account without the permission", () => {
  test("does_not_see_the_mode_choice", async ({ page, context }) => {
    await login(context, "network-scan-denied@example.test", false);
    await page.goto("/escanear");

    await expect(
      page.getByRole("heading", { name: "Escanear", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("radiogroup")).toHaveCount(0);
    await expect(page.getByText("Solo con la IP")).toHaveCount(0);
  });

  test("a_forced_network_request_gets_403_and_the_session_survives", async ({
    page,
    context,
  }) => {
    await login(context, "network-scan-forced@example.test", false);
    const response = await context.request.post("/api/scans", {
      data: { target: "192.0.2.10", mode: "network" },
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({
      error: "network_scan_not_permitted",
    });

    await page.goto("/escanear");
    await expect(
      page.getByRole("heading", { name: "Escanear", level: 2 }),
    ).toBeVisible();
  });
});
