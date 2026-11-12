/**
 * E2E of the admin header (plan `admin-panel-improvements`, AP-01b): a single
 * row at every width. Desktop: title, section links and a menu button at the
 * right end. Mobile: title and menu button, the links live inside the menu.
 * The menu holds identity, theme toggle and logout.
 */
import { expect, test, type Locator } from "@playwright/test";

const WIDTHS = [1280, 1024, 768, 375];
const LONG_EMAIL =
  "administrador.largo.apellido@universidad-ejemplo.example.test";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error("element has no box");
  return found;
}

function overlaps(a: Box, b: Box): boolean {
  const eps = 0.5;
  return (
    a.x + a.width > b.x + eps &&
    b.x + b.width > a.x + eps &&
    a.y + a.height > b.y + eps &&
    b.y + b.height > a.y + eps
  );
}

for (const width of WIDTHS) {
  test(`admin_header_is_one_row_with_a_menu_at_${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const login = await context.request.post("/__test__/session", {
      data: {
        email: LONG_EMAIL,
        name: "Analista Con Nombre Largo",
        role: "admin",
      },
    });
    expect(login.ok()).toBe(true);
    await page.goto("/escanear");

    const header = page.locator("header.app-header");
    const menuButton = header.getByRole("button", { name: "Menú de usuario" });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    // Closed: only title, (desktop) links and the menu button are visible.
    const nav = header.getByRole("navigation", { name: "Secciones" });
    const headerBox = await box(header);
    const buttonBox = await box(menuButton);
    const titleBox = await box(header.locator("h1"));
    const styles = await header.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        padding:
          parseFloat(cs.paddingTop) +
          parseFloat(cs.paddingBottom) +
          parseFloat(cs.borderBottomWidth),
      };
    });
    // One row: the header is no taller than the menu button plus its padding
    // and the (one-line) title allowance.
    expect(headerBox.height, "header is one row").toBeLessThan(
      Math.max(buttonBox.height, titleBox.height) + styles.padding + 8,
    );
    expect(
      headerBox.x + headerBox.width - (buttonBox.x + buttonBox.width),
      "menu button is flush with the right edge",
    ).toBeLessThanOrEqual(2);

    const scroll = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(scroll.doc, "page scrollWidth").toBeLessThanOrEqual(scroll.inner);

    const items: [string, Locator][] = [
      ["title", header.locator("h1")],
      ["menu", menuButton],
    ];
    if (width >= 640) {
      const links = nav.getByRole("link");
      await expect(links).toHaveCount(4);
      (await links.all()).forEach((l, i) => items.push([`link-${i}`, l]));
      const lineHeight = await links.first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      });
      for (const l of await links.all()) {
        expect((await box(l)).height, "link on one line").toBeLessThan(
          lineHeight * 2,
        );
      }
    } else {
      await expect(nav).toHaveCount(0);
      await expect(header.getByRole("link")).toHaveCount(0);
    }
    const boxes = new Map<string, Box>();
    for (const [name, loc] of items) boxes.set(name, await box(loc));
    const names = [...boxes.keys()];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        expect(
          overlaps(boxes.get(names[i]!)!, boxes.get(names[j]!)!),
          `${names[i]} overlaps ${names[j]}`,
        ).toBe(false);
      }
    }

    // Open: identity (ellipsized inside the panel), theme toggle, logout.
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(
      `#${await menuButton.getAttribute("aria-controls")}`,
    );
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Analista Con Nombre Largo");
    await expect(panel).toContainText(LONG_EMAIL);
    await expect(panel.locator(".theme-toggle")).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeVisible();
    if (width < 640) {
      await expect(
        panel.getByRole("navigation", { name: "Secciones" }).getByRole("link"),
      ).toHaveCount(4);
    }
    const panelBox = await box(panel);
    expect(panelBox.x, "panel inside viewport (left)").toBeGreaterThanOrEqual(
      -0.5,
    );
    expect(
      panelBox.x + panelBox.width,
      "panel inside viewport (right)",
    ).toBeLessThanOrEqual(width + 0.5);
    const email = panel.getByText(LONG_EMAIL);
    expect(
      await email.evaluate((el) => getComputedStyle(el).textOverflow),
      "email is ellipsized",
    ).toBe("ellipsis");
    expect((await box(email)).height, "email on one line").toBeLessThan(26);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    // The open panel does not push the header taller.
    expect((await box(header)).height).toBeCloseTo(headerBox.height, 0);

    // Escape closes and returns focus to the button.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toBeFocused();

    // Outside click closes.
    await menuButton.click();
    await expect(panel).toBeVisible();
    await page.mouse.click(5, 790);
    await expect(panel).toBeHidden();
  });
}

test("menu_is_reachable_by_keyboard_in_order_and_closes_on_link_selection", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await context.request.post("/__test__/session", {
    data: { email: LONG_EMAIL, name: "Ada", role: "admin" },
  });
  await page.goto("/escanear");
  const menuButton = page.getByRole("button", { name: "Menú de usuario" });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Escanear" })).toBeFocused();
  await page.getByRole("link", { name: "Historial" }).click();
  await expect(page).toHaveURL(/\/historial$/);
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
});
