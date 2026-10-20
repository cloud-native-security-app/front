/**
 * Dismissible notice shown on the landing page when an authenticated
 * session was ended by a 401/403 (feature `resilient-error-handling`,
 * REH-03). Renders nothing for a first visit: `SessionProvider` only sets
 * `expired` when the previous status was `authenticated`.
 */

import { useState } from "react";

import { useSession } from "./useSession";

export function SessionExpiredNotice() {
  const { expired } = useSession();
  const [dismissed, setDismissed] = useState(false);

  if (!expired || dismissed) {
    return null;
  }

  return (
    <div role="status" className="session-expired-notice">
      <p>Tu sesión expiró. Inicia sesión nuevamente.</p>
      <button type="button" onClick={() => setDismissed(true)}>
        Cerrar aviso
      </button>
    </div>
  );
}
