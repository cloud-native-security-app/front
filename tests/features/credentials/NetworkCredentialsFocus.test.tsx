/**
 * Focus after delete (feature `sectioned-navigation`, SNV-04): once the
 * deleted row disappears, focus goes to the next row's "Borrar" button, to
 * the previous one when the last row was deleted, or to the empty-state
 * message when nothing is left. A failed delete keeps focus where it was.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { NetworkCredential } from "../../../src/api";
import { EMPTY_CREDENTIALS_MESSAGE } from "../../../src/copy";
import { NetworkCredentialsListView } from "../../../src/features/credentials";

function entry(id: string, target: string): NetworkCredential {
  return {
    id,
    user_id: "u",
    target_pattern: target,
    network_user: "root",
    has_sudo: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function Harness({ failDelete = false }: { failDelete?: boolean }) {
  const [entries, setEntries] = useState([
    entry("a", "10.0.0.1"),
    entry("b", "10.0.0.2"),
    entry("c", "10.0.0.3"),
  ]);
  return (
    <NetworkCredentialsListView
      entries={entries}
      rowStates={failDelete ? { a: { status: "error", message: "falló" } } : {}}
      onDelete={(id) => {
        if (!failDelete) {
          setEntries((previous) => previous.filter((e) => e.id !== id));
        }
      }}
    />
  );
}

async function deleteRow(target: string) {
  await userEvent.click(
    screen.getByRole("button", { name: `Borrar credencial de ${target}` }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
}

describe("credential delete focus", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves_focus_to_the_next_rows_delete_button", async () => {
    render(<Harness />);
    await deleteRow("10.0.0.1");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Borrar credencial de 10.0.0.2" }),
      ).toHaveFocus(),
    );
  });

  it("moves_focus_to_the_previous_row_when_the_last_one_is_deleted", async () => {
    render(<Harness />);
    await deleteRow("10.0.0.3");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Borrar credencial de 10.0.0.2" }),
      ).toHaveFocus(),
    );
  });

  it("moves_focus_to_the_empty_message_when_nothing_is_left", async () => {
    render(<Harness />);
    await deleteRow("10.0.0.1");
    await deleteRow("10.0.0.2");
    await deleteRow("10.0.0.3");

    await waitFor(() =>
      expect(screen.getByText(EMPTY_CREDENTIALS_MESSAGE)).toHaveFocus(),
    );
  });

  it("does_not_steal_focus_when_the_delete_fails", async () => {
    render(<Harness failDelete />);
    await deleteRow("10.0.0.1");

    expect(
      screen.getByRole("button", { name: "Borrar credencial de 10.0.0.2" }),
    ).not.toHaveFocus();
  });
});
