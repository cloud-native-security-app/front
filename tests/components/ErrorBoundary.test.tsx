/**
 * Component tests for `ErrorBoundary` (feature `resilient-error-handling`,
 * REH-01): a render exception shows a friendly fallback with a "Recargar"
 * button instead of a blank page, and the error is logged to the console.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { ErrorBoundary } from "../../src/components";

function Bomb(): never {
  throw new Error("boom de prueba");
}

describe("ErrorBoundary", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    // Asserted below (never swallowed silently): React also logs the error.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders_children_when_nothing_throws", () => {
    render(
      <ErrorBoundary>
        <p>contenido sano</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("contenido sano")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("shows_the_friendly_fallback_and_logs_the_error_when_a_child_throws", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal.");
    expect(
      screen.getByRole("button", { name: "Recargar" }),
    ).toBeInTheDocument();
    const loggedBoundaryError = consoleError.mock.calls.some((call) =>
      call.some(
        (arg) => arg instanceof Error && arg.message === "boom de prueba",
      ),
    );
    expect(loggedBoundaryError).toBe(true);
  });

  it("reloads_the_page_when_recargar_is_clicked", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      reload,
    });
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Recargar" }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
