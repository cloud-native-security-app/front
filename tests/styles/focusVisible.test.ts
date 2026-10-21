/**
 * Focus ring (feature `keyboard-and-live-feedback`, KLF-02): one global
 * `:focus-visible` rule covers links, buttons, selects and inputs using the
 * theme-aware accent token (both themes via `light-dark()`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../src/index.css"), "utf8");

describe("global focus-visible style", () => {
  it("covers_links_buttons_selects_and_inputs_with_the_accent_outline", () => {
    const rule = css.match(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g) ?? [];
    const shared = rule.find(
      (block) =>
        block.includes("a:focus-visible") &&
        block.includes("button:focus-visible") &&
        block.includes("select:focus-visible") &&
        block.includes("input:focus-visible") &&
        block.includes("textarea:focus-visible"),
    );
    expect(shared).toBeDefined();
    expect(shared).toMatch(/outline:\s*3px solid var\(--color-accent\)/);
    expect(shared).toMatch(/outline-offset:\s*2px/);
  });

  it("styles_the_skip_link_visible_only_on_focus", () => {
    expect(css).toMatch(/\.skip-link:not\(:focus\)/);
    expect(css).toMatch(/\.skip-link:focus/);
  });
});
