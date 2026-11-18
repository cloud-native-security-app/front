/**
 * History polling fallback of the scan page (feature `scan-live-status`,
 * SC-03). The SSE stream is best effort: it can drop, and the gateway keeps
 * no state for a scan that finished long ago or before a restart (it sends
 * nothing and leaves the stream open). While the scan is not terminal and
 * the stream is `reconnecting`/`closed`, or no event arrived within
 * `SILENCE_BEFORE_POLLING_MS`, the status is read from `getScanHistory`
 * every `SCAN_STATUS_POLL_INTERVAL_MS` and applied once it is terminal.
 */

import { useEffect, useState } from "react";

import {
  getScanHistory,
  type ConnectionStatus,
  type ScanStatus,
} from "../../api";
import { isTerminalScanStatus } from "./scanStatus";

export const SCAN_STATUS_POLL_INTERVAL_MS = 5000;
export const SILENCE_BEFORE_POLLING_MS = 20000;

export interface ScanStatusFallbackInput {
  scanId: string | undefined;
  status: ScanStatus;
  connectionStatus: ConnectionStatus;
  eventReceived: boolean;
  applyStatus: (status: ScanStatus) => void;
}

export function useScanStatusFallback({
  scanId,
  status,
  connectionStatus,
  eventReceived,
  applyStatus,
}: ScanStatusFallbackInput): void {
  // Id of the scan that stayed silent for too long (derived, so a new scan
  // id never inherits the previous scan's silence).
  const [silentScanId, setSilentScanId] = useState<string | undefined>();

  useEffect(() => {
    if (!scanId || eventReceived) {
      return;
    }
    const timerId = setTimeout(() => {
      setSilentScanId(scanId);
    }, SILENCE_BEFORE_POLLING_MS);
    return () => {
      clearTimeout(timerId);
    };
  }, [scanId, eventReceived]);

  const streamDown =
    connectionStatus === "reconnecting" || connectionStatus === "closed";
  const silent = !eventReceived && silentScanId === scanId;
  const shouldPoll =
    scanId !== undefined &&
    !isTerminalScanStatus(status) &&
    (streamDown || silent);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }
    let active = true;
    const intervalId = setInterval(() => {
      void getScanHistory().then((result) => {
        if (!active || !result.ok) {
          return;
        }
        const entry = result.value.find((item) => item.scanId === scanId);
        if (entry && isTerminalScanStatus(entry.status)) {
          applyStatus(entry.status);
        }
      });
    }, SCAN_STATUS_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [shouldPoll, scanId, applyStatus]);
}
