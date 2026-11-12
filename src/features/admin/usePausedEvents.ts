/**
 * Pause state of the event log (container side). While paused the log shows
 * the events captured when pausing; the feed itself (KPIs, scans, findings)
 * keeps updating because only this view of the events is frozen.
 */

import { useState } from "react";

import type { AdminEventEntry } from "../../api";
import { pausedEvents } from "./boundedLists";

export interface PausedEvents {
  events: AdminEventEntry[];
  paused: boolean;
  /** Events received since pausing (0 while live). */
  pending: number;
  toggle: () => void;
}

export function usePausedEvents(live: AdminEventEntry[]): PausedEvents {
  const [frozen, setFrozen] = useState<AdminEventEntry[] | null>(null);
  const { events, pending } = pausedEvents(live, frozen);
  return {
    events,
    paused: frozen !== null,
    pending,
    toggle: () => {
      setFrozen(frozen === null ? live : null);
    },
  };
}
