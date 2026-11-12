/** `series` of the admin snapshot (feature `admin-panel`, AP-06). */
import { describe, expect, it } from "vitest";

import { isAdminSnapshot } from "../../src/api/adminGuards";
import { makeSnapshot } from "../features/admin/fixtures";

const bucket = {
  minute: "2026-11-11T23:01:00Z",
  by_type: { "scan.completed": 3 },
  findings_by_severity: { high: 2, critical: 1 },
};

describe("isAdminSnapshot series", () => {
  it("accepts_a_snapshot_without_series_from_an_older_backend", () => {
    expect(isAdminSnapshot(makeSnapshot())).toBe(true);
  });

  it("accepts_a_well_formed_series", () => {
    expect(
      isAdminSnapshot({
        ...makeSnapshot(),
        series: {
          bucket_seconds: 60,
          buckets: [
            bucket,
            { ...bucket, by_type: {}, findings_by_severity: {} },
          ],
        },
      }),
    ).toBe(true);
  });

  it.each([
    ["a non-object series", "x"],
    ["no buckets", { bucket_seconds: 60 }],
    [
      "a bucket without minute",
      { bucket_seconds: 60, buckets: [{ ...bucket, minute: 1 }] },
    ],
    [
      "a non-numeric count",
      { bucket_seconds: 60, buckets: [{ ...bucket, by_type: { a: "1" } }] },
    ],
    [
      "a negative count",
      { bucket_seconds: 60, buckets: [{ ...bucket, by_type: { a: -1 } }] },
    ],
    [
      "a missing severity map",
      { bucket_seconds: 60, buckets: [{ minute: bucket.minute, by_type: {} }] },
    ],
    ["a bucket size of zero", { bucket_seconds: 0, buckets: [bucket] }],
  ])("rejects_%s", (_name, series) => {
    expect(isAdminSnapshot({ ...makeSnapshot(), series })).toBe(false);
  });
});
