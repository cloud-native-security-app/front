/** Spanish messages for every way `POST /api/scans` can be refused (NS-04). */
import { describe, expect, it } from "vitest";

import type { ApiError, NetworkScanRejectionReason } from "../../../src/api";
import { describeSubmitError } from "../../../src/features/scan/describeSubmitError";

const REASONS: Record<NetworkScanRejectionReason, RegExp> = {
  target_loopback: /loopback/i,
  target_link_local: /link-local/i,
  target_unique_local: /local única/i,
  target_multicast: /multicast/i,
  target_broadcast: /broadcast/i,
  target_unspecified: /sin especificar/i,
  target_outside_allowed_ranges: /fuera de los rangos/i,
};

describe("describeSubmitError", () => {
  it.each(Object.entries(REASONS))(
    "maps_%s_to_a_specific_message",
    (reason, pattern) => {
      const message = describeSubmitError({
        kind: "network_scan_target_rejected",
        reason: reason as NetworkScanRejectionReason,
      });
      expect(message).toMatch(pattern);
      expect(message).not.toContain("target_");
    },
  );

  it("falls_back_to_a_generic_rejection_for_an_unknown_reason", () => {
    expect(
      describeSubmitError({
        kind: "network_scan_target_rejected",
        reason: "unknown",
      }),
    ).toMatch(/no se puede escanear solo con la IP/i);
  });

  it("maps_403_to_a_permission_message", () => {
    expect(describeSubmitError({ kind: "network_scan_not_permitted" })).toMatch(
      /no tiene permiso/i,
    );
  });

  it("maps_503_to_a_retry_message", () => {
    expect(describeSubmitError({ kind: "network_scan_unavailable" })).toMatch(
      /No pudimos confirmar tu permiso/,
    );
  });

  it("keeps_the_existing_messages", () => {
    const ssh422: ApiError = { kind: "unexpected", status: 422 };
    expect(describeSubmitError(ssh422)).toBe(
      "Primero agrega una credencial de red para esa IP.",
    );
    expect(describeSubmitError({ kind: "unauthorized" })).toMatch(/sesión/i);
  });
});
