/**
 * Pure functions of the per-minute series behind the admin charts (feature
 * `admin-panel`). The snapshot brings the window (oldest bucket first, ending
 * at the current UTC minute); each delta adds +1 to the bucket of its
 * `occurred_at` and a one-minute tick rotates the window. Nothing here reads
 * the clock: callers pass `now`.
 */

import type {
  AdminCountMap,
  AdminEventEntry,
  AdminSeries,
  AdminSeriesBucket,
} from "../../api";

export const BUCKET_SECONDS = 60;
export const BUCKET_COUNT = 15;

const SEVERITIES = ["high", "critical"] as const;

function bucketMs(series: AdminSeries): number {
  return series.bucket_seconds * 1000;
}

function isoMinute(ms: number): string {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

function emptyBucket(ms: number): AdminSeriesBucket {
  return { minute: isoMinute(ms), by_type: {}, findings_by_severity: {} };
}

/** An all-empty window of 15 minutes ending at the minute of `nowMs`. */
export function emptySeries(nowMs: number): AdminSeries {
  const size = BUCKET_SECONDS * 1000;
  const newest = Math.floor(nowMs / size) * size;
  return {
    bucket_seconds: BUCKET_SECONDS,
    buckets: Array.from({ length: BUCKET_COUNT }, (_, i) =>
      emptyBucket(newest - (BUCKET_COUNT - 1 - i) * size),
    ),
  };
}

function bump(map: AdminCountMap, key: string): AdminCountMap {
  return { ...map, [key]: (map[key] ?? 0) + 1 };
}

function severityOf(event: AdminEventEntry): string | undefined {
  const payload = event.payload;
  if (
    event.event_type !== "finding.critical" ||
    typeof payload !== "object" ||
    payload === null
  ) {
    return undefined;
  }
  const severity = (payload as Record<string, unknown>)["severity"];
  return SEVERITIES.find((s) => s === severity);
}

/**
 * Counts one event in the bucket of its minute. A future timestamp (clock
 * skew) clamps to the newest bucket; one older than the window, or unparseable,
 * leaves the series untouched (same reference).
 */
export function applySeriesEvent(
  series: AdminSeries,
  event: AdminEventEntry,
): AdminSeries {
  const newest = series.buckets.at(-1);
  const at = Date.parse(event.occurred_at);
  if (!newest || Number.isNaN(at)) {
    return series;
  }
  const size = bucketMs(series);
  const newestMs = Date.parse(newest.minute);
  const eventMinute = Math.min(Math.floor(at / size) * size, newestMs);
  const index = series.buckets.length - 1 - (newestMs - eventMinute) / size;
  const target = series.buckets[index];
  if (!target) {
    return series;
  }
  const severity = severityOf(event);
  const updated: AdminSeriesBucket = {
    ...target,
    by_type: bump(target.by_type, event.event_type),
    findings_by_severity: severity
      ? bump(target.findings_by_severity, severity)
      : target.findings_by_severity,
  };
  return {
    ...series,
    buckets: series.buckets.map((b, i) => (i === index ? updated : b)),
  };
}

/**
 * Moves the window to the minute of `nowMs`: one empty bucket appended per
 * elapsed minute, the same number dropped from the start. Same reference when
 * nothing elapsed (also when the clock is behind the newest bucket).
 */
export function rotateSeries(series: AdminSeries, nowMs: number): AdminSeries {
  const newest = series.buckets.at(-1);
  if (!newest) {
    return series;
  }
  const size = bucketMs(series);
  const newestMs = Date.parse(newest.minute);
  const steps = Math.floor((Math.floor(nowMs / size) * size - newestMs) / size);
  if (!(steps > 0)) {
    return series;
  }
  const length = series.buckets.length;
  const added = Math.min(steps, length);
  const appended = Array.from({ length: added }, (_, i) =>
    emptyBucket(newestMs + (steps - added + 1 + i) * size),
  );
  return {
    ...series,
    buckets: [...series.buckets.slice(added), ...appended],
  };
}

/** Event types with their own stack segment and fixed color; the rest fold. */
export const CHART_EVENT_TYPES = [
  "scan.requested",
  "scan.started",
  "scan.completed",
  "auth.login",
  "ratelimit.hit",
] as const;
export const OTHER_KEY = "other";
export type StackKey = (typeof CHART_EVENT_TYPES)[number] | typeof OTHER_KEY;
export type StackRow = Partial<Record<StackKey, number>>;

/**
 * One row per bucket: counts of the main types under their own key, every
 * other type summed under `other`. The key depends on the type only, never on
 * its volume, so a color never moves between series. Zero counts are omitted.
 */
export function foldEventTypes(buckets: AdminCountMap[]): StackRow[] {
  const main = new Set<string>(CHART_EVENT_TYPES);
  return buckets.map((counts) => {
    const row: StackRow = {};
    for (const [type, count] of Object.entries(counts)) {
      if (count <= 0) {
        continue;
      }
      const key = main.has(type) ? (type as StackKey) : OTHER_KEY;
      row[key] = (row[key] ?? 0) + count;
    }
    return row;
  });
}

export function scanOutcomes(
  buckets: AdminCountMap[],
): Array<{ completed: number; failed: number }> {
  return buckets.map((c) => ({
    completed: c["scan.completed"] ?? 0,
    failed: c["scan.failed"] ?? 0,
  }));
}

export function severityCounts(
  buckets: AdminCountMap[],
): Array<{ high: number; critical: number }> {
  return buckets.map((c) => ({
    high: c["high"] ?? 0,
    critical: c["critical"] ?? 0,
  }));
}

/** Clean y axis: max rounded up to 1/2/5 x 10^k steps, at least 0..4. */
export function niceScale(value: number): { max: number; ticks: number[] } {
  const target = Math.max(value, 4);
  const rough = target / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
    10 * magnitude;
  const count = Math.ceil(target / step);
  return {
    max: count * step,
    ticks: Array.from({ length: count + 1 }, (_, i) => i * step),
  };
}
