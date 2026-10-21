/**
 * Sectioned navigation (feature `sectioned-navigation`): sections reachable
 * by click and by deep link (the `vite preview` server falls back to
 * `index.html`, like `nginx.conf.template`), browser back/forward, header
 * identity, scanning a saved target without typing, and focus handling.
 */
import { expect, test } from "@playwright/test";

import { seedTarget } from "./seedTarget";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "sections-e2e@example.test", name: "Ada Analista" },
  });
  expect(response.ok()).toBe(true);
});

const heading = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("heading", { level: 2, name });

test("the_header_shows_the_user_and_the_nav_marks_the_current_section", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/escanear$/);
  const banner = page.getByRole("banner");
  await expect(banner).toContainText("Ada Analista");
  await expect(banner).toContainText("sections-e2e@example.test");
  await expect(
    banner.getByRole("button", { name: "Cerrar sesión" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Escanear" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("sections_are_reachable_by_click_and_by_deep_link", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Secciones" });
  await nav.getByRole("link", { name: "Historial" }).click();
  await expect(page).toHaveURL(/\/historial$/);
  await expect(heading(page, "Historial")).toBeFocused();
  await nav.getByRole("link", { name: "Objetivos" }).click();
  await expect(page).toHaveURL(/\/objetivos$/);
  await expect(heading(page, "Objetivos")).toBeFocused();

  for (const [path, name] of [
    ["/historial", "Historial"],
    ["/objetivos", "Objetivos"],
    ["/escanear", "Escanear"],
  ] as const) {
    await page.goto(path);
    await expect(heading(page, name)).toBeVisible();
    await expect(nav.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }

  await page.goto("/ruta-que-no-existe");
  await expect(page).toHaveURL(/\/escanear$/);
  await expect(heading(page, "Escanear")).toBeVisible();
});

test("back_and_forward_move_between_sections", async ({ page }) => {
  await page.goto("/escanear");
  const nav = page.getByRole("navigation", { name: "Secciones" });
  await nav.getByRole("link", { name: "Historial" }).click();
  await nav.getByRole("link", { name: "Objetivos" }).click();
  await expect(heading(page, "Objetivos")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/historial$/);
  await expect(heading(page, "Historial")).toBeVisible();
  await page.goBack();
  await expect(heading(page, "Escanear")).toBeVisible();
  await page.goForward();
  await expect(heading(page, "Historial")).toBeVisible();
});

test("scanning_a_saved_target_needs_no_typing", async ({ page }) => {
  await page.goto("/objetivos");
  await page.getByLabel("IP del objetivo").fill("172.16.70.3");
  await page.getByLabel("Usuario de red").fill("root");
  await page.getByLabel("Credencial SSH").fill("vault://ssh/e2e-lab-key");
  await page.getByRole("button", { name: "Agregar credencial" }).click();
  await expect(page.getByText("Credencial guardada.")).toBeVisible();

  await page.getByRole("link", { name: "Escanear" }).click();
  await page.getByLabel("Objetivo a escanear").selectOption("172.16.70.3");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Escanear", exact: true }).click();

  await expect(page.getByText(/^Estado: /)).toContainText("Completado");
  await page.getByRole("link", { name: "Historial" }).click();
  await expect(page.locator("tr", { hasText: "172.16.70.3" })).toContainText(
    "Completado",
  );
});

test("without_saved_targets_the_scan_section_links_to_objetivos", async ({
  page,
}) => {
  await page.goto("/escanear");

  await expect(
    page.getByText("Agrega un objetivo para poder escanear."),
  ).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Objetivos" }).click();
  await expect(page).toHaveURL(/\/objetivos$/);
});

test("deleting_a_target_moves_focus_to_the_next_row", async ({
  page,
  context,
}) => {
  await seedTarget(context, "172.16.71.1");
  await seedTarget(context, "172.16.71.2");
  await page.goto("/objetivos");

  await page
    .getByRole("button", { name: "Borrar credencial de 172.16.71.1" })
    .click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();

  await expect(
    page.getByRole("button", { name: "Borrar credencial de 172.16.71.2" }),
  ).toBeFocused();
});
