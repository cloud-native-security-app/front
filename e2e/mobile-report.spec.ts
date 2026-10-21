/**
 * Feature `mobile-report`: at 390 px no section scrolls sideways and the row
 * actions stay reachable (tables render as cards below 640 px).
 */
import { expect, test, type Page } from "@playwright/test";

import { seedTarget } from "./seedTarget";

const TARGET = "172.16.70.9";

test.beforeEach(async ({ context, page }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "mobile-report-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
});

async function overflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

async function scrollableTables(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll("table")].filter(
        (t) => t.scrollWidth > t.clientWidth,
      ).length,
  );
}

test("no_section_scrolls_sideways_at_390_and_actions_stay_clickable", async ({
  page,
  context,
}) => {
  await seedTarget(context, TARGET);

  await page.goto("/objetivos");
  const del = page.getByRole("button", {
    name: `Borrar credencial de ${TARGET}`,
  });
  await expect(del).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await scrollableTables(page)).toBe(0);
  // Reachable and tappable: click opens the confirmation, then back out.
  await del.click();
  await expect(
    page.getByRole("group", { name: `Confirmar borrado de ${TARGET}` }),
  ).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await page
    .getByRole("group", { name: `Confirmar borrado de ${TARGET}` })
    .getByRole("button", { name: "Cancelar" })
    .click();

  await page.goto("/escanear");
  await expect(page.getByLabel("Objetivo a escanear")).toBeVisible();
  await page.getByLabel("Objetivo a escanear").selectOption(TARGET);
  await page.getByRole("button", { name: "Escanear", exact: true }).click();
  await expect(page.getByText(/^Estado: /)).toContainText("Completado");
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: "Historial" }).click();
  const viewReport = page.getByRole("button", {
    name: `Ver reporte de ${TARGET}`,
  });
  await expect(viewReport).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await scrollableTables(page)).toBe(0);
  await viewReport.click();

  await expect(
    page.getByRole("heading", { name: /puertos y servicios/i }),
  ).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await scrollableTables(page)).toBe(0);
  await page.screenshot({
    path: "test-results/report-390.png",
    fullPage: true,
  });
});
