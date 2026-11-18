import { describe, expect, it } from "vitest";

import {
  CANCEL_CONFLICT_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from "../../../src/copy";
import { describeCancelError } from "../../../src/features/scan";

describe("describeCancelError", () => {
  it("maps_each_error_kind_to_its_message", () => {
    expect(describeCancelError({ kind: "conflict", message: "x" })).toBe(
      CANCEL_CONFLICT_MESSAGE,
    );
    expect(describeCancelError({ kind: "unauthorized" })).toBe(
      SESSION_EXPIRED_MESSAGE,
    );
    expect(describeCancelError({ kind: "not_found" })).toMatch(/ya no existe/);
    expect(describeCancelError({ kind: "network" })).toMatch(/cancelar/);
  });
});
