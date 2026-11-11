/**
 * Presentational admin panel (feature `admin-panel`): receives the snapshot
 * and the connection status, knows nothing about `src/api`.
 */

import type { AdminSnapshot } from "../../api";
import {
  ADMIN_CONNECTION_LABEL,
  SECTION_ADMIN,
  adminConnectionMessage,
} from "../../copy";
import type { AdminFeedStatus } from "./useAdminFeed";
import { CriticalFindingsFeed } from "./CriticalFindingsFeed";
import { EventLog } from "./EventLog";
import { KpiTiles } from "./KpiTiles";
import { ScansInFlightList } from "./ScansInFlightList";
import "./admin.css";

type ViewStatus = Extract<
  AdminFeedStatus,
  "connecting" | "live" | "reconnecting" | "unavailable"
>;

export function AdminPanelView({
  snapshot,
  status,
}: {
  snapshot: AdminSnapshot;
  status: ViewStatus;
}) {
  return (
    <section aria-label={SECTION_ADMIN} className="admin-panel">
      <h2 tabIndex={-1} data-section-heading>
        {SECTION_ADMIN}
      </h2>
      <p role="status" aria-label={ADMIN_CONNECTION_LABEL} data-tone="neutral">
        {adminConnectionMessage(status)}
      </p>
      <KpiTiles kpis={snapshot.kpis} windowSeconds={snapshot.window_seconds} />
      <ScansInFlightList scans={snapshot.scans_in_flight} />
      <CriticalFindingsFeed findings={snapshot.critical_findings} />
      <EventLog events={snapshot.recent_events} />
    </section>
  );
}
