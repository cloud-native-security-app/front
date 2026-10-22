/**
 * Regression guard: the authenticated header's top row must not reflow when
 * the theme is cycled (the toggle used to be a variable-width text button).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "header-theme-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("header_top_row_stays_stable_across_theme_cycles", async ({ page }) => {
  await page.goto("/");
  const header = page.locator(".app-header");
  const toggle = header.locator(".theme-toggle");
  const logout = header.getByRole("button", { name: "Cerrar sesión" });
  await expect(toggle).toBeVisible();

  const snapshots: Array<{
    toggleBox: { x: number; y: number; width: number; height: number };
    logoutBox: { x: number; y: number; width: number; height: number };
    headerHeight: number;
  }> = [];

  for (const [index, theme] of ["system", "light", "dark"].entries()) {
    if (index > 0) await toggle.click();
    const toggleBox = await toggle.boundingBox();
    const logoutBox = await logout.boundingBox();
    const headerBox = await header.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(logoutBox).not.toBeNull();
    snapshots.push({
      toggleBox: toggleBox!,
      logoutBox: logoutBox!,
      headerHeight: headerBox!.height,
    });
    await header.screenshot({
      path: `test-results/header-after-${theme}.png`,
    });
  }

  const [first, ...rest] = snapshots;
  for (const next of rest) {
    expect(next.toggleBox).toEqual(first!.toggleBox);
    expect(next.logoutBox).toEqual(first!.logoutBox);
    expect(next.headerHeight).toBe(first!.headerHeight);
  }
  // Controls are vertically centered on the same row line.
  const centerY = (b: { y: number; height: number }) => b.y + b.height / 2;
  expect(
    Math.abs(centerY(first!.toggleBox) - centerY(first!.logoutBox)),
  ).toBeLessThanOrEqual(1);
});
