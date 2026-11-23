/**
 * Presentational test of `ReportEmailStatus`: one line per email status of the
 * report, nothing when the status is absent or unknown.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReportEmailStatus } from "../../../src/features/report/ReportEmailStatus";

describe("ReportEmailStatus", () => {
  afterEach(() => {
    cleanup();
  });

  it("sent_shows_the_account_email", () => {
    render(
      <ReportEmailStatus
        status="sent"
        email="ana@example.test"
        emailedAt="2026-01-01T00:00:00Z"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Informe enviado a ana@example.test",
    );
  });

  it("sent_without_a_known_email_still_says_it_was_sent", () => {
    render(<ReportEmailStatus status="sent" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Informe enviado por correo",
    );
  });

  it("pending_says_it_is_being_sent", () => {
    render(<ReportEmailStatus status="pending" email="ana@example.test" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enviando el informe a ana@example.test…",
    );
  });

  it("failed_says_it_could_not_be_sent", () => {
    render(<ReportEmailStatus status="failed" email="ana@example.test" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No se pudo enviar el informe por correo.",
    );
  });

  it("disabled_says_email_is_not_configured", () => {
    render(<ReportEmailStatus status="disabled" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "El envío por correo no está configurado.",
    );
  });

  it("absent_status_renders_nothing", () => {
    const { container } = render(<ReportEmailStatus email="a@b.test" />);
    expect(container).toBeEmptyDOMElement();
  });
});
