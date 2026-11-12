/**
 * E2E of the admin header layout (plan `admin-panel-improvements`, AP-01):
 * with the fourth "Administración" link plus the user block, the header items
 * must not overlap, wrap their text or overflow the viewport at any width.
 */
import { expect, test, type Locator } from "@playwright/test";

const WIDTHS = [1280, 1024, 768, 375];
// A realistic long institutional address: the user block is what competes
// with the four links for space.
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
  test(`admin_header_fits_without_overlap_at_${width}px`, async ({
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
    const links = page
      .getByRole("navigation", { name: "Secciones" })
      .getByRole("link");
    await expect(links).toHaveCount(4);

    const items: [string, Locator][] = [
      ["title", header.locator("h1")],
      ...(await links.all()).map((l, i): [string, Locator] => [`link-${i}`, l]),
      ["theme", header.locator(".theme-toggle")],
      ["identity", header.locator(".app-header__identity")],
      ["logout", header.locator(".app-header__user button:not(.theme-toggle)")],
    ];
    const boxes = new Map<string, Box>();
    for (const [name, loc] of items) boxes.set(name, await box(loc));

    // No overflow of the page or of the header.
    const scroll = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(scroll.doc, "page scrollWidth").toBeLessThanOrEqual(scroll.inner);
    const headerBox = await box(header);
    for (const [name, b] of boxes) {
      expect(b.x, `${name} left`).toBeGreaterThanOrEqual(headerBox.x - 0.5);
      expect(b.x + b.width, `${name} right`).toBeLessThanOrEqual(
        headerBox.x + headerBox.width + 0.5,
      );
    }

    // Every link renders on one line.
    const lineHeight = await links.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    });
    for (const [name, b] of boxes) {
      if (!name.startsWith("link-")) continue;
      expect(b.height, `${name} height`).toBeLessThan(lineHeight * 2);
    }

    // Observed defect: the links claim the whole first row, so the user block
    // fell to a second row, left-aligned under the title. It must sit on the
    // right edge of the header, beside the title or on a row of its own.
    const logout = boxes.get("logout")!;
    expect(
      headerBox.x + headerBox.width - (logout.x + logout.width),
      "logout is flush with the header's right edge",
    ).toBeLessThanOrEqual(2);

    // The name and email never wrap onto a second line.
    const identity = boxes.get("identity")!;
    const identityLine = await header
      .locator(".app-header__identity strong")
      .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 20);
    const lines = width < 640 ? 1 : 2;
    expect(identity.height, "identity height").toBeLessThan(
      identityLine * lines * 1.6,
    );

    // No two items overlap.
    const names = [...boxes.keys()];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i]!;
        const b = names[j]!;
        expect(
          overlaps(boxes.get(a)!, boxes.get(b)!),
          `${a} overlaps ${b}`,
        ).toBe(false);
      }
    }
  });
}
