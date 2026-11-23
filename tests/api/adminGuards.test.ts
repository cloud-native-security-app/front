/** `series` of the admin snapshot (feature `admin-panel`, AP-06). */
import { describe, expect, it } from "vitest";

import {
  isAdminSnapshot,
  normalizeAdminDelta,
  normalizeAdminSnapshot,
} from "../../src/api/adminGuards";
import { makeDelta, makeSnapshot } from "../features/admin/fixtures";

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

const alert = {
  event_id: "siem-1",
  occurred_at: "2026-11-11T10:00:00Z",
  severity: "high",
  rule_id: "5712",
  rule_level: 10,
  description: "sshd: brute force",
  agent: { id: "001", name: "web-01" },
  src_ip: "10.0.0.5",
  dest_ip: null,
  signature: "ET SCAN",
};

describe("normalizeAdminSnapshot siem", () => {
  it("defaults_siem_for_an_older_backend_without_the_fields", () => {
    const old = makeSnapshot() as unknown as Record<string, unknown>;
    delete old["siem_enabled"];
    delete old["siem_alerts"];
    const kpis = { ...(old["kpis"] as Record<string, unknown>) };
    delete kpis["siem_alerts"];
    delete kpis["siem_alerts_by_severity"];
    const snapshot = normalizeAdminSnapshot({ ...old, kpis });
    expect(snapshot?.siem_enabled).toBe(false);
    expect(snapshot?.siem_alerts).toEqual([]);
    expect(snapshot?.kpis.siem_alerts).toBe(0);
    expect(snapshot?.kpis.siem_alerts_by_severity).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
  });

  it("keeps_well_formed_alerts_and_the_counts", () => {
    const base = makeSnapshot();
    const snapshot = normalizeAdminSnapshot({
      ...base,
      siem_enabled: true,
      siem_alerts: [alert],
      kpis: {
        ...base.kpis,
        siem_alerts: 4,
        siem_alerts_by_severity: { low: 1, medium: 1, high: 2, critical: 0 },
      },
    });
    expect(snapshot?.siem_enabled).toBe(true);
    expect(snapshot?.siem_alerts).toEqual([alert]);
    expect(snapshot?.kpis.siem_alerts).toBe(4);
    expect(snapshot?.kpis.siem_alerts_by_severity.high).toBe(2);
  });

  it.each([
    ["an unknown severity", { ...alert, severity: "urgent" }],
    ["a missing event_id", { ...alert, event_id: undefined }],
    ["a rule_level out of range", { ...alert, rule_level: 16 }],
    ["a missing agent name", { ...alert, agent: { id: "001" } }],
    ["a non-string ip", { ...alert, src_ip: 4 }],
    ["not an object", "x"],
  ])("drops_an_alert_with_%s_without_failing_the_snapshot", (_name, bad) => {
    const snapshot = normalizeAdminSnapshot({
      ...makeSnapshot(),
      siem_enabled: true,
      siem_alerts: [bad, alert],
    });
    expect(snapshot?.siem_alerts).toEqual([alert]);
  });

  it("treats_a_non_boolean_siem_enabled_and_a_non_array_list_as_off_and_empty", () => {
    const snapshot = normalizeAdminSnapshot({
      ...makeSnapshot(),
      siem_enabled: "yes",
      siem_alerts: "x",
    });
    expect(snapshot?.siem_enabled).toBe(false);
    expect(snapshot?.siem_alerts).toEqual([]);
  });

  it("returns_undefined_when_the_base_snapshot_is_invalid", () => {
    expect(normalizeAdminSnapshot({ ...makeSnapshot(), seq: "x" })).toBe(
      undefined,
    );
  });
});

describe("normalizeAdminDelta siem", () => {
  it("accepts_an_older_delta_without_siem_fields", () => {
    const old = makeDelta() as unknown as Record<string, unknown>;
    delete old["siem_alert"];
    const delta = normalizeAdminDelta(old);
    expect(delta?.siem_alert).toBeNull();
    expect(delta?.kpis.siem_alerts_by_severity).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
  });

  it("keeps_a_valid_siem_alert_and_drops_a_malformed_one", () => {
    expect(
      normalizeAdminDelta({ ...makeDelta(), siem_alert: alert })?.siem_alert,
    ).toEqual(alert);
    const dropped = normalizeAdminDelta({
      ...makeDelta(),
      siem_alert: { ...alert, severity: "urgent" },
    });
    expect(dropped).toBeDefined();
    expect(dropped?.siem_alert).toBeNull();
  });
});
