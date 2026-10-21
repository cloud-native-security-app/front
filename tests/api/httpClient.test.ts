import { afterEach, describe, expect, it, vi } from "vitest";

import { gatewayBaseUrl } from "../../src/api";
import { performRequest } from "../../src/api/httpClient";
import { useContractServer } from "./testHelpers";

describe("performRequest", () => {
  useContractServer();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["GET", "POST", "DELETE"] as const)(
    "pasa_cache_no_store_y_credentials_include_a_fetch_en_%s",
    async (method) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await performRequest("/api/me", {
        method,
        jsonBody: method === "POST" ? {} : undefined,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        `${gatewayBaseUrl()}/api/me`,
        expect.objectContaining({
          method,
          cache: "no-store",
          credentials: "include",
        }),
      );
    },
  );
});

describe("performRequest body read failures (REH-02)", () => {
  useContractServer();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resuelve_con_networkError_si_la_lectura_del_body_falla_en_vez_de_rechazar", async () => {
    const text = vi
      .fn()
      .mockRejectedValue(new TypeError("body stream interrumpido"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      text,
    } as unknown as Response);

    await expect(performRequest("/api/me")).resolves.toEqual({
      networkError: true,
    });
    expect(text).toHaveBeenCalledTimes(1);
  });
});
