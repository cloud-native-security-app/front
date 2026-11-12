/**
 * Pure helpers that keep the admin lists bounded on screen (AP-02). The
 * reducer already caps what it stores; these decide what is rendered.
 */

import type { AdminEventEntry, AdminInFlightScan } from "../../api";

/** Scans in flight rendered at once (the reducer keeps up to 1000). */
export const MAX_VISIBLE_SCANS = 50;

/**
 * The reducer keeps scans oldest first, so the newest `max` are the last
 * ones; `hidden` counts the older scans that are not rendered.
 */
export function newestScans(
  scans: AdminInFlightScan[],
  max = MAX_VISIBLE_SCANS,
): { shown: AdminInFlightScan[]; hidden: number } {
  const hidden = Math.max(0, scans.length - max);
  return { shown: hidden === 0 ? scans : scans.slice(hidden), hidden };
}

/**
 * Events to render while the log may be paused. `frozen` is the snapshot
 * taken when pausing (`null` when live). `pending` counts the live events
 * newer than the frozen head; when that head already rolled out of the
 * capped log (or the log was empty) every live event is newer.
 */
export function pausedEvents(
  live: AdminEventEntry[],
  frozen: AdminEventEntry[] | null,
): { events: AdminEventEntry[]; pending: number } {
  if (frozen === null) {
    return { events: live, pending: 0 };
  }
  const head = frozen.at(0);
  const index = head
    ? live.findIndex((event) => event.event_id === head.event_id)
    : -1;
  return { events: frozen, pending: index === -1 ? live.length : index };
}
