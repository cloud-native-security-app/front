/**
 * Presentational admin panel (feature `admin-panel`): receives the snapshot
 * and the connection status, knows nothing about `src/api`. The section and
 * its heading belong to the container so the heading (the focus target after
 * navigating) is never remounted when the data arrives.
 */

import type { AdminSnapshot } from "../../api";
import { ADMIN_CONNECTION_LABEL, adminConnectionMessage } from "../../copy";
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
    <div className="admin-panel">
      <p role="status" aria-label={ADMIN_CONNECTION_LABEL} data-tone="neutral">
        {adminConnectionMessage(status)}
      </p>
      <KpiTiles kpis={snapshot.kpis} windowSeconds={snapshot.window_seconds} />
      <ScansInFlightList scans={snapshot.scans_in_flight} />
      <CriticalFindingsFeed findings={snapshot.critical_findings} />
      <EventLog events={snapshot.recent_events} />
    </div>
  );
}
