/**
 * Keyboard and live feedback (feature `keyboard-and-live-feedback`): the skip
 * link is the first Tab stop and jumps to the section heading.
 */
import { expect, test } from "@playwright/test";

test("tab_reaches_the_skip_link_first_and_it_focuses_the_section_heading", async ({
  page,
  context,
}) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "keyboard-e2e@example.test", name: "Ada Analista" },
  });
  expect(response.ok()).toBe(true);

  await page.goto("/historial");
  await expect(
    page.getByRole("heading", { level: 2, name: "Historial" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 2, name: "Historial" }),
  ).toBeFocused();
});
