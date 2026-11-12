/** Accessible horizontal tabs of the admin panel (AP-10). */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  AdminTabs,
  type AdminTabDefinition,
} from "../../../src/features/admin/AdminTabs";

function Harness({
  unseen = [0, 0, 0],
}: {
  unseen?: [number, number, number];
}) {
  const [selected, setSelected] = useState("one");
  const tabs: AdminTabDefinition[] = [
    { id: "one", label: "Uno", unseen: unseen[0], panel: <p>Panel uno</p> },
    { id: "two", label: "Dos", unseen: unseen[1], panel: <p>Panel dos</p> },
    { id: "three", label: "Tres", unseen: unseen[2], panel: <p>Panel tres</p> },
  ];
  return (
    <AdminTabs
      label="Secciones de prueba"
      tabs={tabs}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

describe("AdminTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes_a_named_tablist_with_three_tabs_and_the_first_selected", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist", { name: "Secciones de prueba" });
    expect(list).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Uno", "Dos", "Tres"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("uses_a_roving_tabindex", () => {
    render(<Harness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
    ]);
  });

  it("links_each_tab_to_its_panel_and_keeps_inactive_panels_mounted_hidden", () => {
    render(<Harness />);
    const [one, two] = screen.getAllByRole("tab");
    expect(one).toHaveAttribute("aria-controls");
    const panel = screen.getByRole("tabpanel", { name: "Uno" });
    expect(panel).toHaveAttribute("id", one?.getAttribute("aria-controls"));
    expect(panel).toBeVisible();
    const hidden = screen.getAllByRole("tabpanel", { hidden: true })[1];
    expect(hidden).toHaveAttribute("hidden");
    expect(hidden).toHaveAttribute("aria-labelledby", two?.id);
    expect(hidden).toHaveTextContent("Panel dos");
    expect(two).toHaveAttribute("aria-controls", hidden?.id);
  });

  it("selects_a_tab_on_click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Dos" }));
    expect(screen.getByRole("tab", { name: "Dos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Dos" })).toBeVisible();
  });

  it("moves_focus_and_selection_with_arrows_wrapping_at_both_ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "Uno" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Dos" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Dos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Uno" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Tres" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Tres" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("jumps_to_the_first_and_last_tab_with_home_and_end", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("tab", { name: "Uno" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Tres" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Uno" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Uno" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows_a_badge_and_names_it_for_a_non_selected_tab_with_unseen_items", () => {
    render(<Harness unseen={[5, 3, 0]} />);
    // The selected tab never shows a count, whatever it is given.
    expect(screen.getByRole("tab", { name: "Uno" })).toHaveTextContent(/^Uno$/);
    const two = screen.getByRole("tab", { name: "Dos, 3 nuevos" });
    expect(two).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: "Tres" })).toBeInTheDocument();
  });

  it("caps_the_displayed_count_at_99_plus", () => {
    render(<Harness unseen={[0, 250, 1]} />);
    const two = screen.getByRole("tab", { name: /^Dos, / });
    expect(two).toHaveTextContent("99+");
    expect(screen.getByRole("tab", { name: "Tres, 1 nuevo" })).toBeVisible();
  });
});
