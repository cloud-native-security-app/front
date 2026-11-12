/** Pure helpers that bound the admin lists (AP-02). */
import { describe, expect, it } from "vitest";

import {
  MAX_VISIBLE_SCANS,
  newestScans,
  pausedEvents,
} from "../../../src/features/admin/boundedLists";
import { makeEvent } from "./fixtures";

const scan = (id: string) => ({
  scan_id: id,
  status: "running" as const,
  since: "2026-11-11T10:00:00Z",
});

describe("newestScans", () => {
  it("shows_every_scan_when_under_the_limit", () => {
    const scans = [scan("a"), scan("b")];
    expect(newestScans(scans, 5)).toEqual({ shown: scans, hidden: 0 });
  });

  it("keeps_the_newest_n_and_counts_the_hidden_ones", () => {
    // The reducer keeps scans oldest first, so the newest are the last ones.
    const scans = ["a", "b", "c", "d", "e"].map(scan);
    const { shown, hidden } = newestScans(scans, 2);
    expect(shown.map((s) => s.scan_id)).toEqual(["d", "e"]);
    expect(hidden).toBe(3);
  });

  it("defaults_to_50_visible_scans", () => {
    expect(MAX_VISIBLE_SCANS).toBe(50);
    const scans = Array.from({ length: 120 }, (_, i) => scan(`s${String(i)}`));
    const { shown, hidden } = newestScans(scans);
    expect(shown).toHaveLength(50);
    expect(hidden).toBe(70);
    expect(shown.at(-1)?.scan_id).toBe("s119");
  });
});

describe("pausedEvents", () => {
  const live = ["e3", "e2", "e1"].map((id) => makeEvent(id));

  it("returns_the_live_events_when_not_paused", () => {
    expect(pausedEvents(live, null)).toEqual({ events: live, pending: 0 });
  });

  it("returns_the_frozen_snapshot_and_counts_events_received_since", () => {
    const frozen = live.slice(1);
    const result = pausedEvents(live, frozen);
    expect(result.events).toBe(frozen);
    expect(result.pending).toBe(1);
  });

  it("counts_zero_when_nothing_new_arrived", () => {
    expect(pausedEvents(live, live).pending).toBe(0);
  });

  it("counts_the_whole_live_log_when_the_frozen_head_rolled_out", () => {
    const frozen = [makeEvent("gone")];
    expect(pausedEvents(live, frozen).pending).toBe(live.length);
  });

  it("counts_every_event_when_frozen_while_the_log_was_empty", () => {
    expect(pausedEvents(live, []).pending).toBe(live.length);
  });
});
