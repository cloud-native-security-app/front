/**
 * Container of the admin panel (feature `admin-panel`): wires the data hook
 * to the presentational view and renders the non-data states (loading, role
 * revoked, session ended). Only an admin gets here (`AdminRoute`), but the
 * Gateway stays the authority: a 403 clears the data and leaves a message.
 * The section heading is rendered once here, so it keeps the focus that the
 * router gives it after navigating while the content below changes.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  ADMIN_CONNECTION_LABEL,
  ADMIN_FORBIDDEN_MESSAGE,
  ADMIN_LOADING_MESSAGE,
  BACK_TO_SCAN_LABEL,
  SECTION_ADMIN,
  SESSION_EXPIRED_MESSAGE,
  adminConnectionMessage,
} from "../../copy";
import { AdminPanelView } from "./AdminPanelView";
import { useAdminFeed } from "./useAdminFeed";

/** `scanPath` is where "back" leads (the routing layer owns the paths). */
export function AdminPanel({ scanPath }: { scanPath: string }) {
  const { status, snapshot } = useAdminFeed();

  let body: ReactNode;
  if (status === "forbidden") {
    body = (
      <>
        <p role="alert">{ADMIN_FORBIDDEN_MESSAGE}</p>
        <p>
          <Link to={scanPath}>{BACK_TO_SCAN_LABEL}</Link>
        </p>
      </>
    );
  } else if (status === "session_ended") {
    body = <p role="alert">{SESSION_EXPIRED_MESSAGE}</p>;
  } else if (snapshot) {
    body = <AdminPanelView snapshot={snapshot} status={status} />;
  } else if (status === "connecting") {
    body = (
      <p role="status" data-tone="neutral">
        {ADMIN_LOADING_MESSAGE}
      </p>
    );
  } else {
    body = (
      <p role="status" aria-label={ADMIN_CONNECTION_LABEL} data-tone="neutral">
        {adminConnectionMessage(
          status === "unavailable" ? "unavailable" : "reconnecting",
        )}
      </p>
    );
  }

  return (
    <section aria-label={SECTION_ADMIN}>
      <h2 tabIndex={-1} data-section-heading>
        {SECTION_ADMIN}
      </h2>
      {body}
    </section>
  );
}
