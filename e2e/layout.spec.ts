/**
 * Layout acceptance for feature `layout-and-forms`: landing centered on wide
 * screens, credential form on one row at >= 960 px and stacked at 390 px,
 * scan form on one line at >= 640 px. Screenshots go to `test-results/`
 * (gitignored) for manual review.
 */
import { expect, test } from "@playwright/test";

import { seedTarget } from "./seedTarget";

test("landing_is_horizontally_centered_at_1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const shell = page.locator(".home-page__shell");
  await expect(shell).toBeVisible();
  const box = await shell.boundingBox();
  expect(box).not.toBeNull();
  const left = box!.x;
  const right = 1440 - (box!.x + box!.width);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(8);
  expect(left).toBeGreaterThan(40);
  await page.screenshot({ path: "test-results/landing-1440.png" });
});

test("landing_keeps_the_mobile_layout_at_390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".home-page__shell")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/landing-390.png" });
});

test.describe("authenticated dashboard", () => {
  test.beforeEach(async ({ context }) => {
    const response = await context.request.post("/__test__/session", {
      data: { email: "layout-e2e@example.test", name: "Analista E2E" },
    });
    expect(response.ok()).toBe(true);
  });

  async function top(page: import("@playwright/test").Page, label: string) {
    return page
      .getByLabel(label, { exact: true })
      .evaluate((el) => (el as HTMLElement).getBoundingClientRect().top);
  }

  test("credential_form_shares_one_row_at_1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/objetivos");
    await expect(page.getByLabel("IP del objetivo")).toBeVisible();
    const tops = [
      await top(page, "IP del objetivo"),
      await top(page, "Usuario de red"),
      await top(page, "Credencial SSH"),
    ];
    expect(tops[1]).toBeCloseTo(tops[0]!, 0);
    expect(tops[2]).toBeCloseTo(tops[0]!, 0);
    const buttonTop = await page
      .getByRole("button", { name: "Agregar credencial" })
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(buttonTop - tops[0]!)).toBeLessThanOrEqual(12);
    await page.screenshot({
      path: "test-results/objetivos-1440.png",
      fullPage: true,
    });
  });

  test("scan_form_is_one_line_at_1440_and_sections_are_captured", async ({
    page,
    context,
  }) => {
    await seedTarget(context, "172.16.60.1");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/escanear");
    const select = page.getByLabel("Objetivo a escanear");
    await expect(select).toBeVisible();

    const centerY = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    const selectCenter = await centerY(select);
    const buttonCenter = await centerY(
      page.getByRole("button", { name: "Escanear", exact: true }),
    );
    expect(Math.abs(buttonCenter - selectCenter)).toBeLessThanOrEqual(6);
    await page.screenshot({
      path: "test-results/escanear-1440.png",
      fullPage: true,
    });

    await page.goto("/historial");
    await expect(
      page.getByRole("heading", { level: 2, name: "Historial" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/historial-1440.png",
      fullPage: true,
    });
  });

  test("credential_and_scan_forms_stack_at_390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/objetivos");
    await expect(page.getByLabel("IP del objetivo")).toBeVisible();
    const ip = await top(page, "IP del objetivo");
    const user = await top(page, "Usuario de red");
    const secret = await top(page, "Credencial SSH");
    expect(user).toBeGreaterThan(ip + 20);
    expect(secret).toBeGreaterThan(user + 20);
    for (const path of ["/objetivos", "/escanear", "/historial"]) {
      await page.goto(path);
      await expect(page.getByRole("banner")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
    await page.screenshot({
      path: "test-results/dashboard-390.png",
      fullPage: true,
    });
  });
});
