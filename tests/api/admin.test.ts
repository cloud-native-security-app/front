/** `src/api/admin.ts` against the contract server (feature `admin-panel`, AP-03). */
import { beforeEach, describe, expect, it } from "vitest";

import { getAdminMetrics, gatewayBaseUrl, onUnauthorized } from "../../src/api";
import {
  isAdminDelta,
  isAdminSnapshot,
  isAdminStreamClosed,
} from "../../src/api/adminGuards";
import {
  makeDelta,
  makeEvent,
  makeFinding,
  makeSnapshot,
} from "../features/admin/fixtures";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./testHelpers";

async function setAdminStatus(status: number | null): Promise<void> {
  await fetch(`${gatewayBaseUrl()}/__test__/admin/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

describe("getAdminMetrics", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await setAdminStatus(null);
  });

  it("returns_the_snapshot_for_an_admin", async () => {
    await loginAsSyntheticUser({ role: "admin" });

    const result = await getAdminMetrics();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isAdminSnapshot(result.value)).toBe(true);
      expect(result.value.kpis.scans_in_flight).toBeGreaterThanOrEqual(0);
    }
  });

  it("maps_403_to_forbidden_without_notifying_unauthorized", async () => {
    await loginAsSyntheticUser();
    let notified = 0;
    const off = onUnauthorized(() => {
      notified += 1;
    });

    const result = await getAdminMetrics();
    off();

    expect(result).toEqual({ ok: false, error: { kind: "forbidden" } });
    expect(notified).toBe(0);
  });

  it("maps_401_to_unauthorized_and_notifies", async () => {
    let notified = 0;
    const off = onUnauthorized(() => {
      notified += 1;
    });

    const result = await getAdminMetrics();
    off();

    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
    expect(notified).toBe(1);
  });

  it("maps_503_to_unavailable", async () => {
    await loginAsSyntheticUser({ role: "admin" });
    await setAdminStatus(503);

    expect(await getAdminMetrics()).toEqual({
      ok: false,
      error: { kind: "unavailable" },
    });
  });
});

describe("admin guards", () => {
  it("accept_the_gateway_shapes", () => {
    expect(isAdminSnapshot(makeSnapshot())).toBe(true);
    expect(
      isAdminSnapshot(
        makeSnapshot({
          recent_events: [makeEvent("e", { actor_sub: undefined })],
          critical_findings: [makeFinding("f", { port: null, protocol: null })],
        }),
      ),
    ).toBe(true);
    expect(isAdminDelta(makeDelta())).toBe(true);
    expect(isAdminStreamClosed({ reason: "role_revalidation_failed" })).toBe(
      true,
    );
  });

  it("reject_malformed_payloads", () => {
    expect(isAdminSnapshot(null)).toBe(false);
    expect(isAdminSnapshot({ ...makeSnapshot(), kpis: {} })).toBe(false);
    expect(
      isAdminSnapshot({ ...makeSnapshot(), critical_findings: [{}] }),
    ).toBe(false);
    expect(isAdminDelta({ ...makeDelta(), seq: "2" })).toBe(false);
    expect(
      isAdminDelta({ ...makeDelta(), scan_change: { scan_id: "s" } }),
    ).toBe(false);
    expect(isAdminStreamClosed({})).toBe(false);
  });
});
