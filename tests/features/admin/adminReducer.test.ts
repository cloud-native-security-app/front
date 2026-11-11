/** Reducer of the admin feed (feature `admin-panel`, AP-03). */
import { describe, expect, it } from "vitest";

import {
  MAX_CRITICAL_FINDINGS,
  MAX_IN_FLIGHT,
  MAX_RECENT_EVENTS,
  adminReducer,
} from "../../../src/features/admin";
import {
  makeDelta,
  makeEvent,
  makeFinding,
  makeKpis,
  makeSnapshot,
} from "./fixtures";

describe("adminReducer", () => {
  it("snapshot_replaces_the_whole_state", () => {
    const first = makeSnapshot({
      seq: 5,
      recent_events: [makeEvent("a")],
      critical_findings: [makeFinding("f1")],
    });
    const second = makeSnapshot({ seq: 9, recent_events: [makeEvent("b")] });

    const state = adminReducer(
      adminReducer(undefined, snap(first)),
      snap(second),
    );

    expect(state).toEqual(second);
  });

  it("a_delta_before_any_snapshot_is_ignored", () => {
    expect(adminReducer(undefined, delta(makeDelta()))).toBeUndefined();
  });

  it("a_delta_replaces_kpis_and_prepends_the_event", () => {
    const base = makeSnapshot({
      seq: 1,
      recent_events: [makeEvent("old")],
    });
    const next = adminReducer(
      base,
      delta(
        makeDelta({
          seq: 2,
          event: makeEvent("new"),
          kpis: makeKpis({ completed_last_window: 3, failure_rate: 0.25 }),
        }),
      ),
    );

    expect(next?.seq).toBe(2);
    expect(next?.kpis.completed_last_window).toBe(3);
    expect(next?.kpis.failure_rate).toBe(0.25);
    expect(next?.recent_events.map((e) => e.event_id)).toEqual(["new", "old"]);
  });

  it("a_malformed_record_delta_without_event_only_updates_kpis", () => {
    const base = makeSnapshot({ recent_events: [makeEvent("old")] });
    const next = adminReducer(
      base,
      delta(makeDelta({ seq: 2, kpis: makeKpis({ malformed_records: 1 }) })),
    );
    expect(next?.recent_events).toHaveLength(1);
    expect(next?.kpis.malformed_records).toBe(1);
  });

  it("caps_the_event_log_and_the_critical_findings_like_the_gateway", () => {
    let state = makeSnapshot({
      seq: 0,
      recent_events: Array.from({ length: MAX_RECENT_EVENTS }, (_, i) =>
        makeEvent(`e${String(i)}`),
      ),
      critical_findings: Array.from({ length: MAX_CRITICAL_FINDINGS }, (_, i) =>
        makeFinding(`f${String(i)}`),
      ),
    }) as ReturnType<typeof makeSnapshot> | undefined;

    state = adminReducer(
      state,
      delta(
        makeDelta({
          seq: 1,
          event: makeEvent("newest"),
          critical_finding: makeFinding("newest-f"),
        }),
      ),
    );

    expect(state?.recent_events).toHaveLength(MAX_RECENT_EVENTS);
    expect(state?.recent_events[0].event_id).toBe("newest");
    expect(state?.critical_findings).toHaveLength(MAX_CRITICAL_FINDINGS);
    expect(state?.critical_findings[0].event_id).toBe("newest-f");
  });

  it("a_critical_finding_is_added_newest_first_without_duplicates", () => {
    const base = makeSnapshot({ critical_findings: [makeFinding("f1")] });
    const withNew = adminReducer(
      base,
      delta(makeDelta({ seq: 2, critical_finding: makeFinding("f2") })),
    );
    const again = adminReducer(
      withNew,
      delta(makeDelta({ seq: 3, critical_finding: makeFinding("f2") })),
    );

    expect(again?.critical_findings.map((f) => f.event_id)).toEqual([
      "f2",
      "f1",
    ]);
  });

  it("scan_changes_upsert_and_remove_scans_in_flight", () => {
    let state = adminReducer(undefined, snap(makeSnapshot({ seq: 1 })));

    state = adminReducer(
      state,
      delta(
        makeDelta({
          seq: 2,
          event: makeEvent("e1", {
            event_type: "scan.requested",
            scan_id: "s1",
            occurred_at: "2026-11-11T10:01:00Z",
          }),
          scan_change: { scan_id: "s1", status: "requested" },
        }),
      ),
    );
    expect(state?.scans_in_flight).toEqual([
      { scan_id: "s1", status: "requested", since: "2026-11-11T10:01:00Z" },
    ]);

    state = adminReducer(
      state,
      delta(
        makeDelta({
          seq: 3,
          scan_change: { scan_id: "s1", status: "running" },
        }),
      ),
    );
    expect(state?.scans_in_flight).toEqual([
      { scan_id: "s1", status: "running", since: "2026-11-11T10:01:00Z" },
    ]);

    state = adminReducer(
      state,
      delta(
        makeDelta({
          seq: 4,
          scan_change: { scan_id: "s1", status: "finished" },
        }),
      ),
    );
    expect(state?.scans_in_flight).toEqual([]);
  });

  it("caps_scans_in_flight_evicting_the_oldest", () => {
    let state = makeSnapshot({
      seq: 0,
      scans_in_flight: Array.from({ length: MAX_IN_FLIGHT }, (_, i) => ({
        scan_id: `s${String(i)}`,
        status: "running" as const,
        since: "2026-11-11T09:00:00Z",
      })),
    }) as ReturnType<typeof makeSnapshot> | undefined;

    state = adminReducer(
      state,
      delta(
        makeDelta({
          seq: 1,
          scan_change: { scan_id: "extra", status: "requested" },
        }),
      ),
    );

    expect(state?.scans_in_flight).toHaveLength(MAX_IN_FLIGHT);
    expect(state?.scans_in_flight[0].scan_id).toBe("s1");
    expect(state?.scans_in_flight.at(-1)?.scan_id).toBe("extra");
  });

  it("ignores_a_delta_that_is_not_newer_than_the_state", () => {
    const base = makeSnapshot({ seq: 7, recent_events: [makeEvent("a")] });
    const next = adminReducer(
      base,
      delta(makeDelta({ seq: 7, event: makeEvent("dup") })),
    );
    expect(next).toBe(base);
  });
});

function snap(snapshot: ReturnType<typeof makeSnapshot>) {
  return { type: "snapshot", snapshot } as const;
}

function delta(value: ReturnType<typeof makeDelta>) {
  return { type: "delta", delta: value } as const;
}
