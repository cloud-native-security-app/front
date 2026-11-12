/**
 * Pure reducer of the admin feed (feature `admin-panel`). The state is the
 * gateway snapshot itself: `snapshot` replaces it, `delta` merges into it
 * with the same caps the Gateway applies (so a long-lived tab stays bounded).
 */

import type { AdminDelta, AdminSnapshot } from "../../api";
import { applySeriesEvent, rotateSeries } from "./series";

export const MAX_RECENT_EVENTS = 100;
export const MAX_CRITICAL_FINDINGS = 50;
export const MAX_IN_FLIGHT = 1000;

export type AdminState = AdminSnapshot | undefined;

export type AdminAction =
  | { type: "snapshot"; snapshot: AdminSnapshot }
  | { type: "delta"; delta: AdminDelta }
  /** One-minute clock tick: rotates the series window to the minute of `now`. */
  | { type: "tick"; now: number }
  /** Drops all data (e.g. the admin role was revoked). */
  | { type: "reset" };

function applyScanChange(
  state: AdminSnapshot,
  delta: AdminDelta,
): AdminSnapshot["scans_in_flight"] {
  const change = delta.scan_change;
  if (!change) {
    return state.scans_in_flight;
  }
  const others = state.scans_in_flight.filter(
    (scan) => scan.scan_id !== change.scan_id,
  );
  if (change.status === "finished") {
    return others;
  }
  const existing = state.scans_in_flight.find(
    (scan) => scan.scan_id === change.scan_id,
  );
  const entry = {
    scan_id: change.scan_id,
    status: change.status,
    // The delta does not carry `since`: keep the known one, else use the
    // time of the event that started tracking it.
    since: existing?.since ?? delta.event?.occurred_at ?? state.generated_at,
  };
  // An update keeps its position (oldest first); a new scan goes last.
  const next = existing
    ? state.scans_in_flight.map((scan) =>
        scan.scan_id === change.scan_id ? entry : scan,
      )
    : [...others, entry];
  return next.slice(-MAX_IN_FLIGHT);
}

function applyDelta(state: AdminSnapshot, delta: AdminDelta): AdminSnapshot {
  const finding = delta.critical_finding;
  const findings =
    finding &&
    !state.critical_findings.some((f) => f.event_id === finding.event_id)
      ? [finding, ...state.critical_findings].slice(0, MAX_CRITICAL_FINDINGS)
      : state.critical_findings;
  const events = delta.event
    ? [delta.event, ...state.recent_events].slice(0, MAX_RECENT_EVENTS)
    : state.recent_events;

  return {
    ...state,
    seq: delta.seq,
    kpis: delta.kpis,
    scans_in_flight: applyScanChange(state, delta),
    critical_findings: findings,
    recent_events: events,
    ...(state.series && delta.event
      ? { series: applySeriesEvent(state.series, delta.event) }
      : {}),
  };
}

export function adminReducer(
  state: AdminState,
  action: AdminAction,
): AdminState {
  switch (action.type) {
    case "snapshot":
      return action.snapshot;
    case "reset":
      return undefined;
    case "tick": {
      if (!state?.series) {
        return state;
      }
      const series = rotateSeries(state.series, action.now);
      return series === state.series ? state : { ...state, series };
    }
    case "delta":
      // No snapshot yet, or a duplicate/out-of-order delta: nothing to merge.
      if (!state || action.delta.seq <= state.seq) {
        return state;
      }
      return applyDelta(state, action.delta);
  }
}
