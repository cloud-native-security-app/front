/**
 * The scan notice live region is a container, not a status message: it must
 * cancel the global `[role="status"]` chrome so an empty region is invisible.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../src/index.css"), "utf8");

describe("scan notice region style", () => {
  it("cancels_the_inherited_status_chrome_when_empty", () => {
    const block = css.match(/\.scan-notice-region\s*\{([^}]*)\}/)?.[1];
    expect(block).toBeDefined();
    expect(block).toMatch(/padding:\s*0\b/);
    expect(block).toMatch(/border:\s*0\b/);
    expect(block).toMatch(/background(-color)?:\s*(none|transparent)/);
  });
});
