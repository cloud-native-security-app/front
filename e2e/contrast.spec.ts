/**
 * Automated contrast check (feature `theme-and-contrast`, TAC-04): axe-core
 * runs on the landing (anonymous) and on Escanear, Historial, Objetivos and
 * an open report (authenticated through the contract server), in both
 * themes. The theme is chosen the way a user does (persisted choice read at
 * startup), and the assertion is zero `color-contrast` violations.
 *
 * Scope: `color-contrast` only. Other axe rules are not part of this
 * feature's acceptance; see odd/tasks/theme-and-contrast.md (Evidence).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { seedTarget } from "./seedTarget";

const THEMES = ["light", "dark"] as const;

// The landing panel fades lines in and out (decorative); axe would sample a
// mid-fade colour, so check the at-rest state like a reduced-motion user.
test.use({ reducedMotion: "reduce" });

async function expectNoContrastViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  const summary = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${node.target.join(" ")} -> ${node.failureSummary ?? ""}`,
    ),
  );
  expect(summary, `color-contrast on ${where}`).toEqual([]);
}

for (const theme of THEMES) {
  test.describe(`tema ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem("theme", value);
      }, theme);
    });

    test(`landing_anonima_cumple_el_contraste_en_${theme}`, async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(
        page.getByRole("button", { name: "Iniciar sesión" }),
      ).toBeVisible();
      await expectNoContrastViolations(page, `landing (${theme})`);
    });

    test(`secciones_y_reporte_cumplen_el_contraste_en_${theme}`, async ({
      page,
      context,
    }) => {
      const target = theme === "light" ? "172.16.60.1" : "172.16.60.2";
      const session = await context.request.post("/__test__/session", {
        data: { email: `contrast-${theme}@example.test`, name: "Analista" },
      });
      expect(session.ok()).toBe(true);
      await seedTarget(context, target);

      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByLabel("Objetivo a escanear")).toBeVisible();
      await expectNoContrastViolations(page, `Escanear (${theme})`);

      await page.getByLabel("Objetivo a escanear").selectOption(target);
      await page.getByRole("button", { name: "Escanear" }).click();
      await expect(page.getByText(/^Estado: /)).toContainText("Completado");

      await page.getByRole("link", { name: "Historial" }).click();
      const row = page.locator("tr", { hasText: target });
      await expect(row).toContainText("Completado");
      await expectNoContrastViolations(page, `Historial (${theme})`);

      await page.getByRole("link", { name: "Objetivos" }).click();
      await expect(
        page.getByRole("heading", { name: "Objetivos" }),
      ).toBeVisible();
      await expect(page.getByText(target).first()).toBeVisible();
      await expectNoContrastViolations(page, `Objetivos (${theme})`);

      await page.getByRole("link", { name: "Historial" }).click();
      await row
        .getByRole("button", { name: `Ver reporte de ${target}` })
        .click();
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`reporte de ${target}`, "i"),
        }),
      ).toBeVisible();
      await expectNoContrastViolations(page, `reporte (${theme})`);

      // Posibles (collapsed by default) and a deselected severity filter are
      // the lowest-contrast states: open/deselect them and re-check.
      await page.getByText(/Posibles \(según versión\)/).click();
      const toggle = page.locator(".severity-toggle").first();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expectNoContrastViolations(page, `reporte expandido (${theme})`);
    });
  });
}

test.describe("preferencia del sistema", () => {
  for (const [scheme, background] of [
    ["light", "rgb(243, 244, 246)"],
    ["dark", "rgb(11, 18, 32)"],
  ] as const) {
    test(`sin_eleccion_guardada_sigue_el_sistema_${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await expect(page.locator("html")).not.toHaveAttribute("data-theme");
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        background,
      );
      await expectNoContrastViolations(page, `landing (sistema ${scheme})`);
    });
  }
});

test("el_boton_de_tema_cambia_y_recuerda_la_eleccion", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Tema: Sistema" }).click();
  await page.getByRole("button", { name: "Tema: Claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(11, 18, 32)",
  );

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
