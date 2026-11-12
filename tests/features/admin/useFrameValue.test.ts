/** Frame-throttled value (feature `admin-panel`, AP-06): charts redraw at most once per frame. */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFrameValue } from "../../../src/features/admin/useFrameValue";

describe("useFrameValue", () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextId: number;
  const request = vi.fn<(cb: FrameRequestCallback) => number>();
  const cancel = vi.fn<(id: number) => void>();

  beforeEach(() => {
    callbacks = new Map();
    nextId = 1;
    request.mockImplementation((cb) => {
      callbacks.set(nextId, cb);
      return nextId++;
    });
    cancel.mockImplementation((id) => {
      callbacks.delete(id);
    });
    vi.stubGlobal("requestAnimationFrame", request);
    vi.stubGlobal("cancelAnimationFrame", cancel);
  });

  afterEach(() => {
    request.mockReset();
    cancel.mockReset();
    vi.unstubAllGlobals();
  });

  function runFrame(): void {
    act(() => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const cb of pending) {
        cb(0);
      }
    });
  }

  it("returns_the_first_value_immediately", () => {
    const { result } = renderHook(({ v }) => useFrameValue(v), {
      initialProps: { v: 1 },
    });
    expect(result.current).toBe(1);
    expect(request).not.toHaveBeenCalled();
  });

  it("coalesces_a_burst_of_updates_into_one_frame_with_the_latest_value", () => {
    const { result, rerender } = renderHook(({ v }) => useFrameValue(v), {
      initialProps: { v: 1 },
    });
    for (let v = 2; v <= 50; v += 1) {
      rerender({ v });
    }
    expect(result.current).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);

    runFrame();

    expect(result.current).toBe(50);
    rerender({ v: 51 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("cancels_the_pending_frame_on_unmount", () => {
    const { rerender, unmount } = renderHook(({ v }) => useFrameValue(v), {
      initialProps: { v: 1 },
    });
    rerender({ v: 2 });
    unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
