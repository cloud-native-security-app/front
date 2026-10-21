/**
 * Skip link (feature `keyboard-and-live-feedback`, KLF-01): "Saltar al
 * contenido" is the first focusable element of the authenticated app and
 * moves focus to the current section heading.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SkipLink } from "../../src/routes/SkipLink";

function renderPage() {
  return render(
    <>
      <SkipLink />
      <button type="button">Otro control</button>
      <main id="main-content" tabIndex={-1}>
        <h2 tabIndex={-1} data-section-heading>
          Historial
        </h2>
      </main>
    </>,
  );
}

describe("SkipLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("is_the_first_element_reached_with_tab", async () => {
    renderPage();
    await userEvent.tab();
    expect(
      screen.getByRole("link", { name: "Saltar al contenido" }),
    ).toHaveFocus();
  });

  it("moves_focus_to_the_section_heading_when_activated", async () => {
    renderPage();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(
      screen.getByRole("heading", { level: 2, name: "Historial" }),
    ).toHaveFocus();
  });

  it("falls_back_to_main_when_there_is_no_section_heading", async () => {
    render(
      <>
        <SkipLink />
        <main id="main-content" tabIndex={-1}>
          <p>Sin título</p>
        </main>
      </>,
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(document.getElementById("main-content")).toHaveFocus();
  });
});
