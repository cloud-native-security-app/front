/**
 * Presentational admin panel (feature `admin-panel`): receives the snapshot
 * and the connection status, knows nothing about `src/api`. The section and
 * its heading belong to the container so the heading (the focus target after
 * navigating) is never remounted when the data arrives.
 */

import { useState } from "react";

import type { AdminSnapshot } from "../../api";
import {
  ADMIN_CONNECTION_LABEL,
  ADMIN_EVENTS_TITLE,
  ADMIN_FINDINGS_TITLE,
  ADMIN_SCANS_TITLE,
  ADMIN_TABS_LABEL,
  adminConnectionMessage,
} from "../../copy";
import type { AdminFeedStatus } from "./useAdminFeed";
import { AdminTabs } from "./AdminTabs";
import { AdminCharts } from "./charts/AdminCharts";
import { CriticalFindingsFeed } from "./CriticalFindingsFeed";
import { EventLog } from "./EventLog";
import { KpiTiles } from "./KpiTiles";
import { ScansInFlightList } from "./ScansInFlightList";
import { useFrameValue } from "./useFrameValue";
import { usePausedEvents } from "./usePausedEvents";
import { useUnseenCounts } from "./useUnseenCounts";
import type { AdminTabId } from "./unseenCounts";
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
  const [tab, setTab] = useState<AdminTabId>("scans");
  const unseen = useUnseenCounts(tab, {
    scans: snapshot.scans_in_flight,
    findings: snapshot.critical_findings,
    events: snapshot.recent_events,
  });
  return (
    <div className="admin-panel">
      <p role="status" aria-label={ADMIN_CONNECTION_LABEL} data-tone="neutral">
        {adminConnectionMessage(status)}
      </p>
      <KpiTiles kpis={snapshot.kpis} windowSeconds={snapshot.window_seconds} />
      <AdminCharts series={series} />
      <AdminTabs
        label={ADMIN_TABS_LABEL}
        selected={tab}
        onSelect={(id) => {
          setTab(id as AdminTabId);
        }}
        tabs={[
          {
            id: "scans",
            label: ADMIN_SCANS_TITLE,
            unseen: unseen.scans,
            panel: <ScansInFlightList scans={snapshot.scans_in_flight} />,
          },
          {
            id: "findings",
            label: ADMIN_FINDINGS_TITLE,
            unseen: unseen.findings,
            panel: (
              <CriticalFindingsFeed findings={snapshot.critical_findings} />
            ),
          },
          {
            id: "events",
            label: ADMIN_EVENTS_TITLE,
            unseen: unseen.events,
            panel: (
              <EventLog
                events={log.events}
                paused={log.paused}
                pending={log.pending}
                onTogglePause={log.toggle}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
