/**
 * Admin feed of the contract server (feature `admin-panel`): a tiny stand-in
 * for the Gateway's `GET /api/admin/metrics` and SSE `GET /api/admin/events`
 * (same shapes, status codes and `snapshot`/`delta`/`closed` events as
 * `gateway/odd/tasks/admin-realtime-feed.md`; the real aggregation lives
 * there). Not part of the real Gateway, and documented here to avoid
 * confusing them:
 * - `POST /__test__/admin/emit`   push one synthetic event (builds the delta)
 * - `POST /__test__/admin/burst`  push `scans` scan.requested events (one new
 *   in-flight scan each) plus `ratelimit.hit` events up to `events` in total
 * - `POST /__test__/admin/status` force 403/503 for every admin route and
 *   end live streams with a `closed` event (`{ "status": null }` clears it)
 * - `POST /__test__/admin/series` `{ "enabled": false }` drops `series` from
 *   the snapshot (an older backend); `true` brings it back
 * - `POST /__test__/admin/siem`   `{ "enabled": true }` turns SIEM on (seed
 *   alert, `siem_enabled: true`) or off (an older/disabled backend: no
 *   alerts); live streams get a fresh `snapshot` frame
 * - `POST /__test__/admin/siem-alert` push one IDS alert (delta with
 *   `siem_alert` and `event: null`, like events-service); ignored when off
 * - `POST /__test__/admin/reset`  back to the seed snapshot
 * - `POST /__test__/session/role` (in `server.ts`) changes the role of the
 *   calling session; a downgrade ends live streams with a `closed` event
 *
 * State is global to the server process (not per session), so specs that use
 * it run serially and reset in `beforeEach`.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  AdminCriticalFinding,
  AdminDelta,
  AdminEventEntry,
  AdminKpis,
  AdminScanChange,
  AdminSiemAlert,
  AdminSiemSeverity,
  AdminSeries,
  AdminSnapshot,
} from "../../src/api/types";

type Write = (event: string, data: unknown) => void;

export interface AdminFeedState {
  snapshot: AdminSnapshot;
  forcedStatus: number | null;
  streams: Map<ServerResponse, Write>;
  counter: number;
  /** Source of `snapshot.series`: the window is rebuilt from these. */
  seriesEvents: SeriesEvent[];
  seriesEnabled: boolean;
  siemEnabled: boolean;
}

interface SeriesEvent {
  at: number;
  type: string;
  severity?: string;
}

const MINUTE = 60_000;

/** The Gateway's window: 15 one-minute buckets ending at the current UTC minute. */
function buildSeries(events: SeriesEvent[], now: number): AdminSeries {
  const newest = Math.floor(now / MINUTE) * MINUTE;
  const buckets = Array.from({ length: 15 }, (_, i) => {
    const start = newest - (14 - i) * MINUTE;
    const by_type: Record<string, number> = {};
    const findings_by_severity: Record<string, number> = {};
    for (const event of events) {
      if (Math.min(Math.floor(event.at / MINUTE) * MINUTE, newest) !== start) {
        continue;
      }
      by_type[event.type] = (by_type[event.type] ?? 0) + 1;
      if (event.severity) {
        findings_by_severity[event.severity] =
          (findings_by_severity[event.severity] ?? 0) + 1;
      }
    }
    return {
      minute: new Date(start).toISOString().replace(".000Z", "Z"),
      by_type,
      findings_by_severity,
    };
  });
  return { bucket_seconds: 60, buckets };
}

function seedSeriesEvents(): SeriesEvent[] {
  const now = Date.now();
  return [
    { at: now - 3 * MINUTE, type: "scan.completed" },
    { at: now - 3 * MINUTE, type: "scan.completed" },
    { at: now - 2 * MINUTE, type: "scan.failed" },
    { at: now - 2 * MINUTE, type: "auth.login" },
    { at: now - 5 * MINUTE, type: "finding.critical", severity: "high" },
  ];
}

/** Puts the current series in the snapshot (or removes it when disabled). */
function refreshSeries(state: AdminFeedState): void {
  const snapshot = { ...state.snapshot };
  delete snapshot.series;
  state.snapshot = state.seriesEnabled
    ? { ...snapshot, series: buildSeries(state.seriesEvents, Date.now()) }
    : snapshot;
}

function seedSnapshot(): AdminSnapshot {
  const now = new Date().toISOString();
  return {
    seq: 10,
    generated_at: now,
    window_seconds: 900,
    kpis: {
      scans_in_flight: 1,
      completed_last_window: 4,
      failed_last_window: 1,
      failure_rate: 0.2,
      active_users: 2,
      rate_limit_hits: 3,
      malformed_records: 0,
      siem_alerts: 0,
      siem_alerts_by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
    },
    scans_in_flight: [
      { scan_id: "scan-seed-1", status: "running", since: now },
    ],
    critical_findings: [
      {
        event_id: "finding-seed-1",
        occurred_at: now,
        scan_id: "scan-seed-0",
        port: 22,
        protocol: "tcp",
        cve_id: "CVE-2024-6387",
        severity: "critical",
        confidence: "confirmed",
      },
    ],
    recent_events: [
      {
        event_id: "event-seed-1",
        event_type: "scan.started",
        occurred_at: now,
        source: "nmap-service",
        scan_id: "scan-seed-1",
        payload: {},
      },
    ],
    siem_enabled: false,
    siem_alerts: [],
  };
}

const SIEM_SEED_ALERT: AdminSiemAlert = {
  event_id: "siem-seed-1",
  occurred_at: new Date().toISOString(),
  severity: "medium",
  rule_id: "5503",
  rule_level: 8,
  description: "PAM: User login failed.",
  agent: { id: "001", name: "web-01" },
  src_ip: "10.0.0.5",
  dest_ip: null,
  signature: null,
};

/** The server keeps at most 8 alerts in the snapshot. */
const SIEM_SNAPSHOT_MAX = 8;

export function createAdminFeedState(): AdminFeedState {
  const state: AdminFeedState = {
    snapshot: seedSnapshot(),
    forcedStatus: null,
    streams: new Map(),
    counter: 0,
    seriesEvents: seedSeriesEvents(),
    seriesEnabled: true,
    siemEnabled: false,
  };
  refreshSeries(state);
  return state;
}

export interface EmitRequest {
  event_type: string;
  scan_id?: string;
  severity?: string;
  port?: number | null;
  protocol?: string | null;
  cve_id?: string | null;
}

function nextKpis(kpis: AdminKpis, type: string): AdminKpis {
  const next = { ...kpis };
  if (type === "scan.completed") {
    next.completed_last_window += 1;
  } else if (type === "scan.failed") {
    next.failed_last_window += 1;
  } else if (type === "ratelimit.hit") {
    next.rate_limit_hits += 1;
  }
  const total = next.completed_last_window + next.failed_last_window;
  next.failure_rate = total === 0 ? null : next.failed_last_window / total;
  return next;
}

function scanChangeFor(request: EmitRequest): AdminScanChange | null {
  if (!request.scan_id) {
    return null;
  }
  switch (request.event_type) {
    case "scan.requested":
      return { scan_id: request.scan_id, status: "requested" };
    case "scan.started":
      return { scan_id: request.scan_id, status: "running" };
    case "scan.completed":
    case "scan.failed":
    case "scan.cancelled":
      return { scan_id: request.scan_id, status: "finished" };
    default:
      return null;
  }
}

/** Applies one synthetic event to the snapshot and broadcasts its delta. */
export function emitAdminEvent(
  state: AdminFeedState,
  request: EmitRequest,
): AdminDelta {
  state.counter += 1;
  const id = `emitted-${String(state.counter)}`;
  const now = new Date().toISOString();
  const event: AdminEventEntry = {
    event_id: id,
    event_type: request.event_type,
    occurred_at: now,
    source: "contract-server",
    ...(request.scan_id ? { scan_id: request.scan_id } : {}),
    payload:
      request.event_type === "finding.critical"
        ? { severity: request.severity ?? "critical" }
        : {},
  };
  state.seriesEvents.push({
    at: Date.now(),
    type: request.event_type,
    ...(request.event_type === "finding.critical"
      ? { severity: request.severity ?? "critical" }
      : {}),
  });
  const finding: AdminCriticalFinding | null =
    request.event_type === "finding.critical"
      ? {
          event_id: id,
          occurred_at: now,
          scan_id: request.scan_id ?? "unknown",
          port: request.port ?? null,
          protocol: request.protocol ?? null,
          cve_id: request.cve_id ?? null,
          severity: request.severity ?? "critical",
          confidence: "confirmed",
        }
      : null;
  const change = scanChangeFor(request);
  const previous = state.snapshot;
  let inFlight = previous.scans_in_flight;
  if (change) {
    inFlight = inFlight.filter((scan) => scan.scan_id !== change.scan_id);
    if (change.status !== "finished") {
      inFlight = [
        ...inFlight,
        { scan_id: change.scan_id, status: change.status, since: now },
      ];
    }
  }
  const kpis = {
    ...nextKpis(previous.kpis, request.event_type),
    scans_in_flight: inFlight.length,
  };
  const delta: AdminDelta = {
    seq: previous.seq + 1,
    event,
    kpis,
    scan_change: change,
    critical_finding: finding,
    siem_alert: null,
  };
  state.snapshot = {
    ...previous,
    seq: delta.seq,
    generated_at: now,
    kpis,
    scans_in_flight: inFlight,
    critical_findings: finding
      ? [finding, ...previous.critical_findings].slice(0, 50)
      : previous.critical_findings,
    recent_events: [event, ...previous.recent_events].slice(0, 100),
  };
  refreshSeries(state);
  for (const write of state.streams.values()) {
    write("delta", delta);
  }
  return delta;
}

/**
 * Emits `scans` `scan.requested` events (one new in-flight scan each) and
 * fills up to `events` total events with `ratelimit.hit`.
 */
export function emitAdminBurst(
  state: AdminFeedState,
  events: number,
  scans: number,
): void {
  for (let i = 0; i < events; i += 1) {
    if (i < scans) {
      emitAdminEvent(state, {
        event_type: "scan.requested",
        scan_id: `burst-scan-${String(state.counter)}`,
      });
    } else {
      emitAdminEvent(state, { event_type: "ratelimit.hit" });
    }
  }
}

/** Forces a status on admin routes; 403/503 also end live streams with `closed`. */
export function forceAdminStatus(
  state: AdminFeedState,
  status: number | null,
): void {
  state.forcedStatus = status;
  if (status === null) {
    return;
  }
  closeAdminStreams(state);
}

/** Ends every live stream with the Gateway's role-revalidation `closed`. */
export function closeAdminStreams(state: AdminFeedState): void {
  for (const [res, write] of state.streams) {
    write("closed", { reason: "role_revalidation_failed" });
    res.end();
  }
  state.streams.clear();
}

export function setAdminSeries(state: AdminFeedState, enabled: boolean): void {
  state.seriesEnabled = enabled;
  refreshSeries(state);
}

function siemKpis(
  alerts: AdminSiemAlert[],
): AdminKpis["siem_alerts_by_severity"] {
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const alert of alerts) {
    counts[alert.severity] += 1;
  }
  return counts;
}

export function setAdminSiem(state: AdminFeedState, enabled: boolean): void {
  state.siemEnabled = enabled;
  const alerts = enabled ? [SIEM_SEED_ALERT] : [];
  state.snapshot = {
    ...state.snapshot,
    siem_enabled: enabled,
    siem_alerts: alerts,
    kpis: {
      ...state.snapshot.kpis,
      siem_alerts: alerts.length,
      siem_alerts_by_severity: siemKpis(alerts),
    },
  };
  refreshSeries(state);
  for (const write of state.streams.values()) {
    write("snapshot", state.snapshot);
  }
}

export interface SiemAlertRequest {
  severity?: AdminSiemSeverity;
  rule_level?: number;
  description?: string;
  signature?: string | null;
}

/** Applies one IDS alert and broadcasts its delta (no `event`, like the real feed). */
export function emitSiemAlert(
  state: AdminFeedState,
  request: SiemAlertRequest,
): void {
  if (!state.siemEnabled) {
    return;
  }
  state.counter += 1;
  const alert: AdminSiemAlert = {
    event_id: `siem-emitted-${String(state.counter)}`,
    occurred_at: new Date().toISOString(),
    severity: request.severity ?? "high",
    rule_id: "5712",
    rule_level: request.rule_level ?? 10,
    description: request.description ?? "sshd: brute force attempt",
    agent: { id: "002", name: "db-01" },
    src_ip: "203.0.113.7",
    dest_ip: "10.0.0.9",
    signature: request.signature ?? null,
  };
  const previous = state.snapshot;
  const counts = { ...previous.kpis.siem_alerts_by_severity };
  counts[alert.severity] += 1;
  const kpis = {
    ...previous.kpis,
    siem_alerts: previous.kpis.siem_alerts + 1,
    siem_alerts_by_severity: counts,
  };
  const delta: AdminDelta = {
    seq: previous.seq + 1,
    event: null,
    kpis,
    scan_change: null,
    critical_finding: null,
    siem_alert: alert,
  };
  state.snapshot = {
    ...previous,
    seq: delta.seq,
    generated_at: alert.occurred_at,
    kpis,
    siem_alerts: [alert, ...previous.siem_alerts].slice(0, SIEM_SNAPSHOT_MAX),
  };
  for (const write of state.streams.values()) {
    write("delta", delta);
  }
}

export function resetAdminFeed(state: AdminFeedState): void {
  state.siemEnabled = false;
  state.snapshot = seedSnapshot();
  state.seriesEvents = seedSeriesEvents();
  state.seriesEnabled = true;
  refreshSeries(state);
  forceAdminStatus(state, null);
  state.counter = 0;
}

function writePlain(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

/**
 * Same order as the Gateway: session (401), then admin role (403), then the
 * forced status. Returns `false` after answering.
 */
function authorize(
  role: "user" | "admin",
  state: AdminFeedState,
  res: ServerResponse,
): boolean {
  if (role !== "admin") {
    writePlain(res, 403, "se requiere rol de administrador");
    return false;
  }
  if (state.forcedStatus !== null) {
    writePlain(res, state.forcedStatus, "estado forzado por el test");
    return false;
  }
  return true;
}

export function handleAdminMetrics(
  role: "user" | "admin",
  state: AdminFeedState,
  res: ServerResponse,
): void {
  if (!authorize(role, state, res)) {
    return;
  }
  refreshSeries(state);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(state.snapshot));
}

export function handleAdminEvents(
  role: "user" | "admin",
  state: AdminFeedState,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (!authorize(role, state, res)) {
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const write: Write = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  refreshSeries(state);
  write("snapshot", state.snapshot);
  state.streams.set(res, write);
  req.on("close", () => {
    state.streams.delete(res);
  });
}
