/**
 * Tests for the session-expiry notice (feature `resilient-error-handling`,
 * REH-03): shown only when an authenticated session is ended by a 401/403,
 * never on a first (never-authenticated) visit, and dismissible.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  SessionContext,
  SessionExpiredNotice,
  SessionProvider,
  useSession,
} from "../../src/auth";
import { notifyUnauthorized } from "../../src/api/unauthorized";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../api/testHelpers";

function StatusProbe() {
  return <p>{`sesion:${useSession().status}`}</p>;
}

describe("SessionExpiredNotice", () => {
  useContractServer();

  afterEach(() => {
    cleanup();
    clearNodeTestSessionCookies();
  });

  it("renders_nothing_for_an_anonymous_session_that_never_expired", () => {
    render(
      <SessionContext.Provider value={{ status: "anonymous", user: undefined }}>
        <SessionExpiredNotice />
      </SessionContext.Provider>,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows_a_dismissible_notice_when_the_session_expired", async () => {
    render(
      <SessionContext.Provider
        value={{ status: "anonymous", user: undefined, expired: true }}
      >
        <SessionExpiredNotice />
      </SessionContext.Provider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Tu sesión expiró. Inicia sesión nuevamente.",
    );

    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("provider_marks_the_session_expired_only_after_it_was_authenticated", async () => {
    await loginAsSyntheticUser();
    render(
      <SessionProvider>
        <StatusProbe />
        <SessionExpiredNotice />
      </SessionProvider>,
    );
    await screen.findByText("sesion:authenticated");
    act(() => {
      notifyUnauthorized();
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Tu sesión expiró.",
    );
  });

  it("provider_does_not_flag_expiry_when_the_first_getMe_is_a_401", async () => {
    render(
      <SessionProvider>
        <StatusProbe />
        <SessionExpiredNotice />
      </SessionProvider>,
    );
    await screen.findByText("sesion:anonymous");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
