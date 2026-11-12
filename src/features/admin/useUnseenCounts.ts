/**
 * Unseen-items counts per admin tab (container side): feeds the pure
 * `advanceUnseen` with the ids the view already receives. The state is
 * adjusted while rendering (React's "derive state from props" pattern), so
 * a badge never lags a render behind the data.
 */

import { useMemo, useState } from "react";

import type {
  AdminCriticalFinding,
  AdminEventEntry,
  AdminInFlightScan,
} from "../../api";
import {
  advanceUnseen,
  initialUnseen,
  type AdminTabId,
  type TabIds,
} from "./unseenCounts";

export function useUnseenCounts(
  selected: AdminTabId,
  lists: {
    scans: AdminInFlightScan[];
    findings: AdminCriticalFinding[];
    /** The live log, not the paused view: paused events still count. */
    events: AdminEventEntry[];
  },
): Record<AdminTabId, number> {
  const scans = useMemo(
    () => lists.scans.map((scan) => scan.scan_id),
    [lists.scans],
  );
  const findings = useMemo(
    () => lists.findings.map((finding) => finding.event_id),
    [lists.findings],
  );
  const events = useMemo(
    () => lists.events.map((event) => event.event_id),
    [lists.events],
  );
  const ids: TabIds = useMemo(
    () => ({ scans, findings, events }),
    [scans, findings, events],
  );

  const [state, setState] = useState(() => initialUnseen(selected, ids));
  const next = advanceUnseen(state, ids, selected);
  if (next !== state) {
    setState(next);
  }
  return next.counts;
}
