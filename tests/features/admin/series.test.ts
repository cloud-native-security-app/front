/** Pure per-minute series of the admin charts (feature `admin-panel`, AP-06). */
import { describe, expect, it } from "vitest";

import type { AdminSeries } from "../../../src/api";
import {
  applySeriesEvent,
  emptySeries,
  foldEventTypes,
  niceScale,
  rotateSeries,
  severityCounts,
  scanOutcomes,
  OTHER_KEY,
} from "../../../src/features/admin/series";
import { makeEvent } from "./fixtures";

const MIN = 60_000;
const NOW = Date.parse("2026-11-11T23:15:30Z");

function series(): AdminSeries {
  return emptySeries(NOW);
}

describe("emptySeries", () => {
  it("builds_15_empty_buckets_oldest_first_ending_at_the_current_minute", () => {
    const s = series();
    expect(s.bucket_seconds).toBe(60);
    expect(s.buckets).toHaveLength(15);
    expect(s.buckets[0]?.minute).toBe("2026-11-11T23:01:00Z");
    expect(s.buckets[14]?.minute).toBe("2026-11-11T23:15:00Z");
    expect(s.buckets.every((b) => Object.keys(b.by_type).length === 0)).toBe(
      true,
    );
  });
});

describe("applySeriesEvent", () => {
  it("adds_one_to_the_type_in_the_bucket_of_its_minute", () => {
    const next = applySeriesEvent(
      series(),
      makeEvent("a", {
        event_type: "scan.completed",
        occurred_at: "2026-11-11T23:14:59Z",
      }),
    );
    expect(next.buckets[13]?.by_type).toEqual({ "scan.completed": 1 });
    expect(next.buckets[14]?.by_type).toEqual({});
    const again = applySeriesEvent(
      next,
      makeEvent("b", {
        event_type: "scan.completed",
        occurred_at: "2026-11-11T23:14:01Z",
      }),
    );
    expect(again.buckets[13]?.by_type["scan.completed"]).toBe(2);
  });

  it("does_not_mutate_its_input", () => {
    const base = series();
    applySeriesEvent(
      base,
      makeEvent("a", { occurred_at: "2026-11-11T23:15:10Z" }),
    );
    expect(base.buckets[14]?.by_type).toEqual({});
  });

  it("clamps_a_future_event_to_the_newest_bucket", () => {
    const next = applySeriesEvent(
      series(),
      makeEvent("a", {
        event_type: "auth.login",
        occurred_at: "2026-11-12T03:00:00Z",
      }),
    );
    expect(next.buckets[14]?.by_type).toEqual({ "auth.login": 1 });
  });

  it("ignores_an_event_older_than_the_oldest_bucket", () => {
    const base = series();
    const next = applySeriesEvent(
      base,
      makeEvent("a", { occurred_at: "2026-11-11T23:00:59Z" }),
    );
    expect(next).toBe(base);
  });

  it("ignores_an_unparseable_timestamp", () => {
    const base = series();
    expect(
      applySeriesEvent(base, makeEvent("a", { occurred_at: "nope" })),
    ).toBe(base);
  });

  it("counts_finding_critical_by_payload_severity", () => {
    const at = "2026-11-11T23:15:00Z";
    let s = series();
    s = applySeriesEvent(
      s,
      makeEvent("a", {
        event_type: "finding.critical",
        occurred_at: at,
        payload: { severity: "high" },
      }),
    );
    s = applySeriesEvent(
      s,
      makeEvent("b", {
        event_type: "finding.critical",
        occurred_at: at,
        payload: { severity: "critical" },
      }),
    );
    s = applySeriesEvent(
      s,
      makeEvent("c", {
        event_type: "finding.critical",
        occurred_at: at,
        payload: { severity: "low" },
      }),
    );
    expect(s.buckets[14]?.findings_by_severity).toEqual({
      high: 1,
      critical: 1,
    });
    expect(s.buckets[14]?.by_type["finding.critical"]).toBe(3);
  });

  it("does_not_count_severity_for_other_event_types", () => {
    const next = applySeriesEvent(
      series(),
      makeEvent("a", {
        event_type: "scan.completed",
        occurred_at: "2026-11-11T23:15:00Z",
        payload: { severity: "high" },
      }),
    );
    expect(next.buckets[14]?.findings_by_severity).toEqual({});
  });
});

describe("rotateSeries", () => {
  it("is_a_no_op_inside_the_same_minute", () => {
    const base = series();
    expect(rotateSeries(base, NOW + 20_000)).toBe(base);
  });

  it("appends_an_empty_bucket_and_drops_the_oldest_each_minute", () => {
    const counted = applySeriesEvent(
      series(),
      makeEvent("a", { occurred_at: "2026-11-11T23:15:00Z" }),
    );
    const next = rotateSeries(counted, NOW + MIN);
    expect(next.buckets).toHaveLength(15);
    expect(next.buckets[0]?.minute).toBe("2026-11-11T23:02:00Z");
    expect(next.buckets[14]?.minute).toBe("2026-11-11T23:16:00Z");
    expect(next.buckets[14]?.by_type).toEqual({});
    expect(next.buckets[13]?.by_type["scan.completed"]).toBe(1);
  });

  it("catches_up_after_a_throttled_tab_and_empties_the_window_past_15_minutes", () => {
    const three = rotateSeries(series(), NOW + 3 * MIN);
    expect(three.buckets[14]?.minute).toBe("2026-11-11T23:18:00Z");
    const far = rotateSeries(series(), NOW + 60 * MIN);
    expect(far.buckets).toHaveLength(15);
    expect(far.buckets[14]?.minute).toBe("2026-11-12T00:15:00Z");
    expect(far.buckets.every((b) => Object.keys(b.by_type).length === 0)).toBe(
      true,
    );
  });

  it("never_rotates_backwards_when_the_client_clock_is_behind", () => {
    const base = series();
    expect(rotateSeries(base, NOW - 10 * MIN)).toBe(base);
  });
});

describe("foldEventTypes", () => {
  it("keeps_the_main_types_under_their_own_key_and_folds_the_rest_into_otros", () => {
    const rows = foldEventTypes([
      {
        "scan.completed": 3,
        "auth.login": 1,
        "scan.failed": 2,
        "audit.recorded": 4,
        "finding.critical": 1,
      },
    ]);
    expect(rows[0]).toEqual({
      "scan.completed": 3,
      "auth.login": 1,
      [OTHER_KEY]: 7,
    });
  });

  it("gives_a_type_the_same_key_regardless_of_the_other_volumes", () => {
    const quiet = foldEventTypes([{ "scan.completed": 1 }])[0];
    const busy = foldEventTypes([
      { "scan.completed": 1, "auth.login": 50, "ratelimit.hit": 70 },
    ])[0];
    expect(quiet?.["scan.completed"]).toBe(busy?.["scan.completed"]);
  });

  it("omits_zero_counts", () => {
    expect(foldEventTypes([{}])[0]).toEqual({});
  });
});

describe("scanOutcomes and severityCounts", () => {
  it("reads_completed_and_failed_per_bucket_treating_a_missing_key_as_zero", () => {
    expect(
      scanOutcomes([{ "scan.completed": 2 }, { "scan.failed": 1 }, {}]),
    ).toEqual([
      { completed: 2, failed: 0 },
      { completed: 0, failed: 1 },
      { completed: 0, failed: 0 },
    ]);
  });

  it("reads_high_and_critical_per_bucket", () => {
    expect(severityCounts([{ high: 2, critical: 1 }, {}])).toEqual([
      { high: 2, critical: 1 },
      { high: 0, critical: 0 },
    ]);
  });
});

describe("niceScale", () => {
  it("rounds_the_max_up_to_a_clean_tick_step_with_a_floor_of_4", () => {
    expect(niceScale(0)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale(3)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale(7)).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] });
    expect(niceScale(23)).toEqual({ max: 30, ticks: [0, 10, 20, 30] });
    expect(niceScale(96)).toEqual({ max: 100, ticks: [0, 50, 100] });
  });

  it("always_covers_the_max_value", () => {
    for (const value of [1, 5, 9, 11, 37, 101, 999, 12345]) {
      expect(niceScale(value).max).toBeGreaterThanOrEqual(value);
    }
  });
});
