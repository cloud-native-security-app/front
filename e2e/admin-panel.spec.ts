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
  type Page,
} from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function adminControl(
  request: APIRequestContext,
  action: "emit" | "status" | "reset" | "burst" | "series",
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

/** Selects an admin tab by its title; an unseen count may follow it. */
async function openTab(page: Page, title: string): Promise<void> {
  const tab = page.getByRole("tab", { name: new RegExp(`^${title}(,|$)`) });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
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
  await openTab(page, "Hallazgos críticos");
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

  await openTab(page, "Registro de eventos");
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
    await openTab(page, "Hallazgos críticos");
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

test.describe("bounded_panel_under_a_burst_of_events", () => {
  const pageHeight = (page: Page): Promise<number> =>
    page.evaluate(() => document.documentElement.scrollHeight);

  test("the_page_height_stays_constant_and_the_lists_scroll_inside_regions", async ({
    page,
    context,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Fill the lists first, so the baseline already has full regions.
    await adminControl(request, "burst", { events: 120, scans: 80 });
    await login(context, "admin");
    await page.goto("/admin");
    await expect(
      page.getByRole("status", { name: "Estado de la conexión" }),
    ).toHaveText("En vivo");
    const before = await pageHeight(page);

    await adminControl(request, "burst", { events: 150, scans: 120 });
    await expect(page.getByText(/^y \d+ más$/)).toBeVisible();

    const after = await pageHeight(page);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
    for (const [tab, name] of [
      ["Registro de eventos", "Lista desplazable de eventos"],
      ["Escaneos en curso", "Lista desplazable de escaneos"],
    ] as const) {
      await openTab(page, tab);
      const region = page.getByRole("region", { name });
      await expect(region).toHaveAttribute("tabindex", "0");
      const { scroll, client } = await region.evaluate((el) => ({
        scroll: el.scrollHeight,
        client: el.clientHeight,
      }));
      expect(scroll).toBeGreaterThan(client);
    }
  });

  test("pausing_freezes_the_log_and_resume_shows_the_latest", async ({
    page,
    context,
    request,
  }) => {
    await login(context, "admin");
    await page.goto("/admin");
    await openTab(page, "Registro de eventos");
    const log = page.getByRole("region", { name: "Registro de eventos" });
    await expect(log.getByRole("row")).toHaveCount(2);

    await log.getByRole("button", { name: "Pausar registro" }).click();
    await adminControl(request, "burst", { events: 5, scans: 0 });
    await expect(log.getByText("5 eventos nuevos")).toBeVisible();
    await expect(log.getByRole("row")).toHaveCount(2);
    // KPIs keep following the feed while the log is frozen.
    await expect(
      page
        .getByRole("region", { name: "Indicadores" })
        .getByText(/Límites de tasa alcanzados/)
        .locator(".."),
    ).toContainText("8");

    await adminControl(request, "burst", { events: 2, scans: 0 });
    await expect(log.getByText("7 eventos nuevos")).toBeVisible();

    await log.getByRole("button", { name: "Reanudar registro" }).click();
    await expect(log.getByRole("row")).toHaveCount(9);
    await expect(log.getByText(/eventos nuevos/)).toHaveCount(0);
  });

  test("the_bounded_regions_pass_axe_in_light_and_dark", async ({
    page,
    context,
    request,
  }) => {
    await adminControl(request, "burst", { events: 120, scans: 80 });
    await login(context, "admin");
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((value) => {
        window.localStorage.setItem("theme", value);
      }, theme);
      await page.goto("/admin");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByText(/^y \d+ más$/)).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    }
  });
});

test.describe("admin_tabs", () => {
  async function openAdmin(page: Page, context: BrowserContext): Promise<void> {
    await login(context, "admin");
    await page.goto("/admin");
    await expect(
      page.getByRole("status", { name: "Estado de la conexión" }),
    ).toHaveText("En vivo");
  }

  test("the_keyboard_moves_between_tabs_with_arrows_home_and_end", async ({
    page,
    context,
  }) => {
    await openAdmin(page, context);
    const list = page.getByRole("tablist", { name: "Actividad del panel" });
    const tabs = list.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("list", { name: "Hallazgos críticos" }),
    ).toBeVisible();

    await page.keyboard.press("End");
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(2)).toBeFocused();
    await expect(
      page.getByRole("region", { name: "Registro de eventos" }),
    ).toBeVisible();
    await page.keyboard.press("Home");
    await expect(tabs.nth(0)).toBeFocused();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");
  });

  test("a_finding_emitted_on_another_tab_shows_a_count_that_selecting_the_tab_clears", async ({
    page,
    context,
    request,
  }) => {
    await openAdmin(page, context);
    await adminControl(request, "emit", {
      event_type: "finding.critical",
      scan_id: "scan-unseen-1",
    });
    await adminControl(request, "emit", {
      event_type: "finding.critical",
      scan_id: "scan-unseen-2",
    });

    const findings = page.getByRole("tab", {
      name: "Hallazgos críticos, 2 nuevos",
    });
    await expect(findings).toBeVisible();
    await expect(findings).toContainText("2");
    // The log also received the events; the selected tab shows no count.
    await expect(
      page.getByRole("tab", { name: "Registro de eventos, 2 nuevos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Escaneos en curso", exact: true }),
    ).toBeVisible();

    await findings.click();
    const selected = page.getByRole("tab", {
      name: "Hallazgos críticos",
      exact: true,
    });
    await expect(selected).toHaveAttribute("aria-selected", "true");
    await expect(selected).toHaveText("Hallazgos críticos");
  });

  test("the_log_keeps_its_pause_and_filter_across_tab_switches", async ({
    page,
    context,
    request,
  }) => {
    await openAdmin(page, context);
    await openTab(page, "Registro de eventos");
    const log = page.getByRole("region", { name: "Registro de eventos" });
    await log.getByRole("button", { name: "Pausar registro" }).click();
    await openTab(page, "Escaneos en curso");
    await adminControl(request, "burst", { events: 3, scans: 0 });
    await expect(
      page.getByRole("tab", { name: "Registro de eventos, 3 nuevos" }),
    ).toBeVisible();
    await openTab(page, "Registro de eventos");
    await expect(
      log.getByRole("button", { name: "Reanudar registro" }),
    ).toBeVisible();
    await expect(log.getByText("3 eventos nuevos")).toBeVisible();
  });

  test("the_tabs_scroll_inside_the_list_and_never_the_page_at_375px", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openAdmin(page, context);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`the_tabs_pass_axe_with_an_unseen_badge_in_${theme}`, async ({
      page,
      context,
      request,
    }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem("theme", value);
      }, theme);
      await openAdmin(page, context);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await adminControl(request, "emit", {
        event_type: "finding.critical",
        scan_id: "scan-axe",
      });
      await expect(
        page.getByRole("tab", { name: "Hallazgos críticos, 1 nuevo" }),
      ).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
      await openTab(page, "Hallazgos críticos");
      const second = await new AxeBuilder({ page }).analyze();
      expect(second.violations.map((v) => v.id)).toEqual([]);
    });
  }
});

test("a_revoked_role_removes_the_admin_link_and_leaves_/admin_without_reloading", async ({
  page,
  context,
}) => {
  await login(context, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("region", { name: "Indicadores" })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "Secciones" });
  await expect(
    sections.getByRole("link", { name: "Administración" }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  const revoke = await context.request.post("/__test__/session/role", {
    data: { role: "user" },
  });
  expect(revoke.status()).toBe(204);

  await expect(page).toHaveURL(/\/escanear$/, { timeout: 15_000 });
  await expect(
    sections.getByRole("link", { name: "Administración" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { __noReload?: boolean }).__noReload,
    ),
  ).toBe(true);
});

test.describe("per_minute_charts", () => {
  /** The charts bucket by client minute: avoid straddling a rotation. */
  async function clearOfMinuteBoundary(page: Page): Promise<void> {
    const remaining = await page.evaluate(() => 60_000 - (Date.now() % 60_000));
    if (remaining < 8000) {
      await page.waitForTimeout(remaining + 500);
    }
  }

  async function openAdmin(
    page: Page,
    context: BrowserContext,
    size = { width: 1280, height: 900 },
  ): Promise<void> {
    await page.setViewportSize(size);
    await login(context, "admin");
    await page.goto("/admin");
    await expect(
      page.getByRole("status", { name: "Estado de la conexión" }),
    ).toHaveText("En vivo");
    await clearOfMinuteBoundary(page);
  }

  const barHeight = (page: Page, key: string): Promise<number> =>
    page
      .getByRole("figure", { name: "Eventos por minuto" })
      .locator(`[data-bar][data-col="14"][data-key="${key}"]`)
      .evaluate((el) => (el as SVGGraphicsElement).getBBox().height);

  test("the_three_charts_show_the_seeded_series_and_the_current_minute_bar_grows_with_deltas", async ({
    page,
    context,
    request,
  }) => {
    await openAdmin(page, context);
    const section = page.getByRole("region", { name: "Gráficos por minuto" });
    await expect(section.getByRole("figure")).toHaveCount(3);
    await expect(
      section
        .getByRole("figure", { name: "Eventos por minuto" })
        .locator("[data-bar]"),
    ).not.toHaveCount(0);
    await expect(
      section.getByText("Sin datos en los últimos 15 minutos."),
    ).toHaveCount(0);

    const events = section.getByRole("figure", { name: "Eventos por minuto" });
    await adminControl(request, "emit", { event_type: "scan.completed" });
    const bar = events.locator(
      '[data-bar][data-col="14"][data-key="scan.completed"]',
    );
    await expect(bar).toHaveCount(1);
    const one = await barHeight(page, "scan.completed");

    for (let i = 0; i < 3; i += 1) {
      await adminControl(request, "emit", { event_type: "scan.completed" });
    }
    await expect
      .poll(() => barHeight(page, "scan.completed"))
      .toBeGreaterThan(one);

    await adminControl(request, "emit", { event_type: "scan.failed" });
    await adminControl(request, "emit", {
      event_type: "finding.critical",
      scan_id: "scan-chart",
      severity: "high",
    });
    await expect(
      section
        .getByRole("figure", {
          name: "Hallazgos críticos por severidad y minuto",
        })
        .locator('[data-bar][data-col="14"][data-key="high"]'),
    ).toHaveCount(1);
    await expect(
      section
        .getByRole("figure", {
          name: "Escaneos completados y fallidos por minuto",
        })
        .locator('[data-bar][data-col="14"][data-key="failed"]'),
    ).toHaveCount(1);
  });

  test("a_tooltip_follows_the_pointer_and_the_keyboard", async ({
    page,
    context,
    request,
  }) => {
    await adminControl(request, "emit", { event_type: "scan.completed" });
    await openAdmin(page, context);
    const figure = page.getByRole("figure", { name: "Eventos por minuto" });
    const tooltip = figure.getByTestId("chart-tooltip");
    await expect(tooltip).toHaveCount(0);

    await figure.locator('[data-hit="14"]').hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Escaneo completado");
    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);

    await figure.getByRole("group", { name: /flechas/ }).focus();
    await expect(tooltip).toBeVisible();
    const before = await tooltip.locator("strong").first().textContent();
    await page.keyboard.press("ArrowLeft");
    await expect(tooltip.locator("strong").first()).not.toHaveText(
      before ?? "",
    );
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });

  test("an_older_backend_without_series_leaves_the_panel_working_with_empty_charts", async ({
    page,
    context,
    request,
  }) => {
    await adminControl(request, "series", { enabled: false });
    await openAdmin(page, context);
    await expect(
      page.getByRole("region", { name: "Indicadores" }),
    ).toBeVisible();
    await expect(
      page.getByText("Sin datos en los últimos 15 minutos."),
    ).toHaveCount(3);
    await adminControl(request, "emit", { event_type: "scan.completed" });
    await expect(
      page.getByRole("table", { name: "Escaneos en curso" }),
    ).toBeVisible();
  });

  test("the_page_height_stays_constant_while_a_burst_moves_the_charts", async ({
    page,
    context,
    request,
  }) => {
    await openAdmin(page, context);
    await adminControl(request, "burst", { events: 120, scans: 80 });
    await expect(page.getByText(/^y \d+ más$/)).toBeVisible();
    const height = () =>
      page.evaluate(() => document.documentElement.scrollHeight);
    const before = await height();
    const bars = page
      .getByRole("figure", { name: "Eventos por minuto" })
      .locator("[data-bar]");
    const barsBefore = await bars.count();

    await adminControl(request, "burst", { events: 150, scans: 120 });
    await expect
      .poll(() =>
        page
          .getByRole("figure", { name: "Eventos por minuto" })
          .locator('[data-bar][data-col="14"][data-key="ratelimit.hit"]')
          .count(),
      )
      .toBe(1);

    expect(Math.abs((await height()) - before)).toBeLessThanOrEqual(8);
    expect(await bars.count()).toBeGreaterThanOrEqual(barsBefore);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`the_charts_pass_axe_with_their_tables_open_in_${theme}`, async ({
      page,
      context,
      request,
    }) => {
      await adminControl(request, "emit", { event_type: "scan.failed" });
      await adminControl(request, "emit", {
        event_type: "finding.critical",
        scan_id: "s",
      });
      await page.addInitScript((value) => {
        window.localStorage.setItem("theme", value);
      }, theme);
      await openAdmin(page, context);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const summary of await page.getByText("Ver como tabla").all()) {
        await summary.click();
      }
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  }
});
