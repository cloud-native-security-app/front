/**
 * Returns `value`, but after the first render it follows the latest value at
 * most once per animation frame, so a burst of updates redraws what depends
 * on it once per frame instead of once per update.
 */

import { useEffect, useRef, useState } from "react";

export function useFrameValue<T>(value: T): T {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    latest.current = value;
    if (Object.is(value, shown) || frame.current !== undefined) {
      return;
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      setShown(latest.current);
    });
  }, [value, shown]);

  useEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  return shown;
}
