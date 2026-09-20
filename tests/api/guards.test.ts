import { describe, expect, it } from "vitest";

import {
  isMeResponse,
  isScanHistoryEntryArray,
  isScanOutcomeEvent,
  isScanResult,
} from "../../src/api/guards";

describe("isMeResponse", () => {
  it("acepta_un_shape_valido", () => {
    expect(isMeResponse({ sub: "1", email: "a@b.test", name: "A" })).toBe(true);
  });

  it("rechaza_un_shape_incompleto", () => {
    expect(isMeResponse({ sub: "1", email: "a@b.test" })).toBe(false);
    expect(isMeResponse(null)).toBe(false);
    expect(isMeResponse("no-es-un-objeto")).toBe(false);
  });
});

describe("isScanHistoryEntryArray", () => {
  it("acepta_un_array_con_scanId_opcional", () => {
    expect(
      isScanHistoryEntryArray([
        {
          target: "10.0.0.1",
          status: "PENDIENTE",
          requested_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ]),
    ).toBe(true);
  });

  it("rechaza_un_status_fuera_del_vocabulario_conocido", () => {
    expect(
      isScanHistoryEntryArray([
        {
          target: "10.0.0.1",
          status: "EN_ESPERA",
          requested_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ]),
    ).toBe(false);
  });
});

describe("isScanOutcomeEvent", () => {
  it("acepta_los_tres_estados_del_wire_format", () => {
    expect(isScanOutcomeEvent({ status: "started", correlation_id: "1" })).toBe(
      true,
    );
    expect(
      isScanOutcomeEvent({
        status: "failed",
        correlation_id: "1",
        reason: "algo falló",
      }),
    ).toBe(true);
    expect(
      isScanOutcomeEvent({
        status: "completed",
        correlation_id: "1",
        result: {
          host: "10.0.0.1",
          ports: [],
          vulnerabilities: [],
          scanned_at: "2026-01-01T00:00:00Z",
        },
      }),
    ).toBe(true);
  });

  it("rechaza_un_status_desconocido_o_un_completed_sin_result", () => {
    expect(
      isScanOutcomeEvent({ status: "pendiente", correlation_id: "1" }),
    ).toBe(false);
    expect(
      isScanOutcomeEvent({ status: "completed", correlation_id: "1" }),
    ).toBe(false);
  });
});

describe("isScanResult", () => {
  it("rechaza_un_puerto_con_forma_invalida", () => {
    expect(
      isScanResult({
        host: "10.0.0.1",
        ports: [
          {
            port: "22",
            protocol: "tcp",
            state: "open",
            service: null,
            version: null,
            cpes: [],
          },
        ],
        vulnerabilities: [],
        scanned_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
});
