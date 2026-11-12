/**
 * Presentational admin panel (feature `admin-panel`): receives the snapshot
 * and the connection status, knows nothing about `src/api`. The section and
 * its heading belong to the container so the heading (the focus target after
 * navigating) is never remounted when the data arrives.
 */

import type { AdminSnapshot } from "../../api";
import { ADMIN_CONNECTION_LABEL, adminConnectionMessage } from "../../copy";
import type { AdminFeedStatus } from "./useAdminFeed";
import { AdminCharts } from "./charts/AdminCharts";
import { CriticalFindingsFeed } from "./CriticalFindingsFeed";
import { EventLog } from "./EventLog";
import { KpiTiles } from "./KpiTiles";
import { ScansInFlightList } from "./ScansInFlightList";
import { useFrameValue } from "./useFrameValue";
import { usePausedEvents } from "./usePausedEvents";
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
  const log = usePausedEvents(snapshot.recent_events);
  // Charts follow the series at most once per animation frame (bursts).
  const series = useFrameValue(snapshot.series);
  return (
    <div className="admin-panel">
      <p role="status" aria-label={ADMIN_CONNECTION_LABEL} data-tone="neutral">
        {adminConnectionMessage(status)}
      </p>
      <KpiTiles kpis={snapshot.kpis} windowSeconds={snapshot.window_seconds} />
      <AdminCharts series={series} />
      <ScansInFlightList scans={snapshot.scans_in_flight} />
      <CriticalFindingsFeed findings={snapshot.critical_findings} />
      <EventLog
        events={log.events}
        paused={log.paused}
        pending={log.pending}
        onTogglePause={log.toggle}
      />
    </div>
  );
}
