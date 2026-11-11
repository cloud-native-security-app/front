/**
 * Container of the admin panel (feature `admin-panel`): wires the data hook
 * to the presentational view and renders the non-data states (loading, role
 * revoked, session ended). Only an admin gets here (`AdminRoute`), but the
 * Gateway stays the authority: a 403 clears the data and leaves a message.
 */

import { Link } from "react-router-dom";

import {
  ADMIN_FORBIDDEN_MESSAGE,
  ADMIN_LOADING_MESSAGE,
  BACK_TO_SCAN_LABEL,
  SECTION_ADMIN,
  SESSION_EXPIRED_MESSAGE,
  ADMIN_CONNECTION_LABEL,
  adminConnectionMessage,
} from "../../copy";
import { AdminPanelView } from "./AdminPanelView";
import { useAdminFeed } from "./useAdminFeed";

function Heading() {
  return (
    <h2 tabIndex={-1} data-section-heading>
      {SECTION_ADMIN}
    </h2>
  );
}

/** `scanPath` is where "back" leads (the routing layer owns the paths). */
export function AdminPanel({ scanPath }: { scanPath: string }) {
  const { status, snapshot } = useAdminFeed();

  if (status === "forbidden") {
    return (
      <section aria-label={SECTION_ADMIN}>
        <Heading />
        <p role="alert">{ADMIN_FORBIDDEN_MESSAGE}</p>
        <p>
          <Link to={scanPath}>{BACK_TO_SCAN_LABEL}</Link>
        </p>
      </section>
    );
  }

  if (status === "session_ended") {
    return (
      <section aria-label={SECTION_ADMIN}>
        <Heading />
        <p role="alert">{SESSION_EXPIRED_MESSAGE}</p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section aria-label={SECTION_ADMIN}>
        <Heading />
        {status === "connecting" ? (
          <p role="status" data-tone="neutral">
            {ADMIN_LOADING_MESSAGE}
          </p>
        ) : (
          <p role="status" aria-label={ADMIN_CONNECTION_LABEL}>
            {adminConnectionMessage(
              status === "unavailable" ? "unavailable" : "reconnecting",
            )}
          </p>
        )}
      </section>
    );
  }

  return <AdminPanelView snapshot={snapshot} status={status} />;
}
