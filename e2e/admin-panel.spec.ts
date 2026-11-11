/**
 * E2E of the admin panel (feature `admin-panel`) against the contract
 * server's admin feed (`e2e/contract-server/adminFeed.ts`): live updates, the
 * role guard, a 403 in mid-session, and light/dark contrast plus mobile
 * overflow. The mock's admin state is global to the server, so this file runs
 * serially and resets it before every test.
 */
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function adminControl(
  request: APIRequestContext,
  action: "emit" | "status" | "reset",
  data: object = {},
): Promise<void> {
  const response = await request.post(`/__test__/admin/${action}`, { data });
  expect(response.status()).toBe(204);
}

async function login(
  context: BrowserContext,
  role: "admin" | "user",
): Promise<void> {
  const response = await context.request.post("/__test__/session", {
    data: {
      email: `admin-panel-${role}@example.test`,
      name: "Analista E2E",
      role,
    },
  });
  expect(response.ok()).toBe(true);
}

test.beforeEach(async ({ request }) => {
  await adminControl(request, "reset");
});

test("an_admin_sees_the_panel_and_live_updates_without_reloading", async ({
  page,
  context,
  request,
}) => {
  await login(context, "admin");
  await page.goto("/escanear");
  await page
    .getByRole("navigation", { name: "Secciones" })
    .getByRole("link", { name: "Administración" })
    .click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Administración" }),
  ).toBeFocused();
  const kpis = page.getByRole("region", { name: "Indicadores" });
  await expect(kpis.getByText("Escaneos en curso").locator("..")).toContainText(
    "1",
  );
  await expect(
    page.getByRole("status", { name: "Estado de la conexión" }),
  ).toHaveText("En vivo");
  await expect(
    page.getByRole("table", { name: "Escaneos en curso" }),
  ).toContainText("scan-seed-1");

  await adminControl(request, "emit", {
    event_type: "scan.completed",
    scan_id: "scan-seed-1",
  });
  await expect(
    kpis.getByText("Completados (últimos 15 min)").locator(".."),
  ).toContainText("5");
  await expect(kpis.getByText("Escaneos en curso").locator("..")).toContainText(
    "0",
  );

  await adminControl(request, "emit", {
    event_type: "finding.critical",
    scan_id: "scan-live-1",
    port: 8080,
    protocol: "tcp",
    cve_id: "CVE-2025-0001",
  });
  const feed = page.getByRole("list", { name: "Hallazgos críticos" });
  await expect(feed.getByRole("listitem").first()).toContainText(
    "Puerto 8080/tcp",
  );
  await expect(
    page.getByRole("status", { name: "Avisos de hallazgos críticos" }),
  ).toContainText("CVE-2025-0001");

  await adminControl(request, "emit", {
    event_type: "finding.critical",
    scan_id: "scan-live-2",
  });
  await expect(feed.getByRole("listitem").first()).toContainText("Host");
  await expect(feed.getByRole("listitem").first()).not.toContainText(/puerto/i);

  const log = page.getByRole("region", { name: "Registro de eventos" });
  await log
    .getByRole("combobox", { name: "Tipo de evento" })
    .selectOption("finding.critical");
  await expect(log.getByRole("row")).toHaveCount(3);
});

test("a_non_admin_is_redirected_and_never_sees_the_admin_link", async ({
  page,
  context,
}) => {
  await login(context, "user");
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/escanear$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Escanear" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("region", { name: "Indicadores" })).toHaveCount(
    0,
  );
});

test("a_403_in_mid_session_leaves_the_panel_with_a_message", async ({
  page,
  context,
  request,
}) => {
  await login(context, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("region", { name: "Indicadores" })).toBeVisible();

  await adminControl(request, "status", { status: 403 });

  await expect(page.getByRole("alert")).toContainText(
    "ya no tiene permisos de administración",
  );
  await expect(page.getByRole("region", { name: "Indicadores" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Volver a Escanear" }).click();
  await expect(page).toHaveURL(/\/escanear$/);
});

test("the_panel_reconnects_with_a_fresh_snapshot_after_a_503", async ({
  page,
  context,
  request,
}) => {
  await login(context, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("region", { name: "Indicadores" })).toBeVisible();

  await adminControl(request, "status", { status: 503 });
  await expect(
    page.getByRole("status", { name: "Estado de la conexión" }),
  ).toContainText(/no pudimos verificar tu rol/i);

  await adminControl(request, "emit", { event_type: "ratelimit.hit" });
  await adminControl(request, "status", { status: null });
  await expect(
    page.getByRole("status", { name: "Estado de la conexión" }),
  ).toHaveText("En vivo", { timeout: 15_000 });
  await expect(
    page
      .getByRole("region", { name: "Indicadores" })
      .getByText(/Límites de tasa alcanzados/)
      .locator(".."),
  ).toContainText("4");
});

for (const theme of ["light", "dark"] as const) {
  test(`the_panel_meets_contrast_and_has_no_horizontal_scroll_in_${theme}`, async ({
    page,
    context,
    request,
  }) => {
    await adminControl(request, "emit", {
      event_type: "finding.critical",
      scan_id: "scan-contrast",
      port: 443,
      protocol: "tcp",
      cve_id: "CVE-2025-0002",
    });
    await page.addInitScript((value) => {
      window.localStorage.setItem("theme", value);
    }, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(context, "admin");
    await page.goto("/admin");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(
      page.getByRole("list", { name: "Hallazgos críticos" }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();
    expect(
      results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" "))),
    ).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/admin-390-${theme}.png` });
  });
}
