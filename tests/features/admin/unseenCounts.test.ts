/** Pure unseen-items counter behind the admin tab badges (AP-10). */
import { describe, expect, it } from "vitest";

import {
  advanceUnseen,
  initialUnseen,
  type TabIds,
} from "../../../src/features/admin/unseenCounts";

const ids = (over: Partial<TabIds> = {}): TabIds => ({
  scans: [],
  findings: [],
  events: [],
  ...over,
});

describe("initialUnseen", () => {
  it("starts_every_count_at_zero_even_with_items_already_present", () => {
    const state = initialUnseen(
      "scans",
      ids({ scans: ["s1"], findings: ["f1"], events: ["e1", "e2"] }),
    );
    expect(state.counts).toEqual({ scans: 0, findings: 0, events: 0 });
  });
});

describe("advanceUnseen", () => {
  it("returns_the_same_state_when_nothing_changed", () => {
    const first = ids({ findings: ["f1"] });
    const state = initialUnseen("scans", first);
    expect(advanceUnseen(state, first, "scans")).toBe(state);
  });

  it("counts_new_ids_in_a_tab_that_is_not_selected", () => {
    const state = initialUnseen("scans", ids({ findings: ["f1"] }));
    const next = advanceUnseen(
      state,
      ids({ findings: ["f2", "f3", "f1"] }),
      "scans",
    );
    expect(next.counts.findings).toBe(2);
    expect(next.counts.scans).toBe(0);
    expect(next.counts.events).toBe(0);
  });

  it("accumulates_across_updates", () => {
    let state = initialUnseen("scans", ids());
    state = advanceUnseen(state, ids({ events: ["e1"] }), "scans");
    state = advanceUnseen(state, ids({ events: ["e2", "e1"] }), "scans");
    expect(state.counts.events).toBe(2);
  });

  it("never_counts_the_selected_tab", () => {
    const state = initialUnseen("findings", ids());
    const next = advanceUnseen(state, ids({ findings: ["f1"] }), "findings");
    expect(next.counts.findings).toBe(0);
  });

  it("clears_the_count_when_a_tab_becomes_selected", () => {
    let state = initialUnseen("scans", ids());
    state = advanceUnseen(state, ids({ findings: ["f1"] }), "scans");
    expect(state.counts.findings).toBe(1);
    state = advanceUnseen(state, ids({ findings: ["f1"] }), "findings");
    expect(state.counts.findings).toBe(0);
  });

  it("does_not_count_a_fresh_snapshot_made_of_items_already_seen", () => {
    let state = initialUnseen("scans", ids({ findings: ["f2", "f1"] }));
    // A reconnect replaces the lists with new arrays holding the same items.
    state = advanceUnseen(state, ids({ findings: ["f2", "f1"] }), "scans");
    expect(state.counts.findings).toBe(0);
  });

  it("counts_only_the_items_a_fresh_snapshot_adds", () => {
    let state = initialUnseen("scans", ids({ findings: ["f1"] }));
    state = advanceUnseen(state, ids({ findings: ["f9", "f1"] }), "scans");
    expect(state.counts.findings).toBe(1);
  });

  it("does_not_count_removals_such_as_a_finished_scan", () => {
    let state = initialUnseen("findings", ids({ scans: ["a", "b"] }));
    state = advanceUnseen(state, ids({ scans: ["a"] }), "findings");
    expect(state.counts.scans).toBe(0);
  });

  it("keeps_counting_events_that_roll_over_the_capped_log", () => {
    let state = initialUnseen("scans", ids({ events: ["e1", "e2"] }));
    state = advanceUnseen(state, ids({ events: ["e3", "e1"] }), "scans");
    state = advanceUnseen(state, ids({ events: ["e4", "e3"] }), "scans");
    expect(state.counts.events).toBe(2);
  });
});
