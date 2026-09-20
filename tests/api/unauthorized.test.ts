/**
 * Tests del canal `onUnauthorized` (ver `src/api/unauthorized.ts`), la
 * pieza que permite a `src/auth` reaccionar a un 401/403 ocurrido en
 * cualquier llamada de `src/api` (feature `auth_session`, criterio 4).
 * Usa el servidor de contrato real, igual que el resto de `tests/api/`
 * (ver docs/verification.md, Nivel 1) — nunca interceptando `fetch`.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { getScanHistory, onUnauthorized } from "../../src/api";
import { clearNodeTestSessionCookies, useContractServer } from "./testHelpers";

describe("onUnauthorized", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  it("notifica_a_los_suscriptores_cuando_cualquier_llamada_de_api_recibe_401", async () => {
    let notifiedTimes = 0;
    const unsubscribe = onUnauthorized(() => {
      notifiedTimes += 1;
    });

    const result = await getScanHistory();

    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
    expect(notifiedTimes).toBe(1);

    unsubscribe();
  });

  it("deja_de_notificar_una_vez_que_el_suscriptor_se_desuscribe", async () => {
    let notifiedTimes = 0;
    const unsubscribe = onUnauthorized(() => {
      notifiedTimes += 1;
    });
    unsubscribe();

    await getScanHistory();

    expect(notifiedTimes).toBe(0);
  });
});
