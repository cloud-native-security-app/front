/**
 * Finished-scan notification (feature `keyboard-and-live-feedback`,
 * KLF-04): a polite live region, visible in any section, announced once per
 * finished scan id and dismissible. Driven through the real provider
 * context value (no network involved).
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { ScanStatus } from "../../../src/api";
import { ScanFinishedNotice } from "../../../src/features/scan";
import {
  ScanActivityContext,
  type ScanActivity,
} from "../../../src/features/scan/scanActivityContext";

function activity(overrides: Partial<ScanActivity>): ScanActivity {
  return {
    scanId: undefined,
    target: undefined,
    status: "PENDIENTE",
    connectionStatus: "open",
    finishedScanId: undefined,
    trackScan: () => {},
    ...overrides,
  };
}

function finished(
  scanId: string,
  status: ScanStatus,
  target?: string,
): ScanActivity {
  return activity({ scanId, target, status, finishedScanId: scanId });
}

function tree(value: ScanActivity): ReactNode {
  return (
    <MemoryRouter initialEntries={["/objetivos"]}>
      <ScanActivityContext.Provider value={value}>
        <ScanFinishedNotice />
      </ScanActivityContext.Provider>
    </MemoryRouter>
  );
}

describe("ScanFinishedNotice", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_an_empty_polite_live_region_while_nothing_finished", () => {
    render(tree(activity({ scanId: "s1", status: "EN_PROGRESO" })));
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("announces_a_completed_scan_with_target_and_a_report_link", () => {
    render(tree(finished("s1", "COMPLETADO", "10.0.0.5")));
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Escaneo de 10.0.0.5 completado");
    expect(screen.getByRole("link", { name: "Ver reporte" })).toHaveAttribute(
      "href",
      "/historial/s1",
    );
  });

  it("omits_the_target_when_it_is_unknown", () => {
    render(tree(finished("s1", "COMPLETADO")));
    expect(screen.getByRole("status")).toHaveTextContent("Escaneo completado");
  });

  it("has_no_report_link_for_failed_or_cancelled_scans", () => {
    const { rerender } = render(tree(finished("s1", "FALLIDO", "10.0.0.5")));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Escaneo de 10.0.0.5 falló",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(tree(finished("s2", "CANCELADO", "10.0.0.5")));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Escaneo de 10.0.0.5 cancelado",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("can_be_dismissed_and_stays_dismissed_for_the_same_scan", async () => {
    const { rerender } = render(tree(finished("s1", "COMPLETADO", "a")));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    rerender(tree(finished("s1", "COMPLETADO", "a")));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces_again_for_a_new_finished_scan_id", async () => {
    const { rerender } = render(tree(finished("s1", "COMPLETADO", "a")));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));

    rerender(tree(finished("s2", "COMPLETADO", "b")));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Escaneo de b completado",
    );
  });
});
