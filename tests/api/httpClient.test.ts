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
