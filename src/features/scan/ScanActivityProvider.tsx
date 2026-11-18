/**
 * Keeps the live scan (SSE) alive across section changes (feature
 * `sectioned-navigation`, SNV-03). `ScanForm` lives in the "Escanear"
 * section and `HistoryTable` in "Historial", so the subscription cannot
 * belong to the form: it would close as soon as the user navigates. The
 * provider owns the tracked scan id and its `useScanEvents` state, and
 * exposes `finishedScanId` (the tracked id once its status is terminal) so
 * the history can refetch immediately instead of waiting for the poll.
 * `markScanCancelled` lets a cancel done outside the stream (scan page or
 * history) update the state; `useScanStatusFallback` covers a dead stream.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { ScanActivityContext, type ScanActivity } from "./scanActivityContext";
import { isTerminalScanStatus } from "./scanStatus";
import { useScanEvents } from "./useScanEvents";
import { useScanStatusFallback } from "./useScanStatusFallback";

export function ScanActivityProvider({ children }: { children: ReactNode }) {
  const [tracked, setTracked] = useState<
    { scanId: string; target: string | undefined } | undefined
  >(undefined);
  const scanId = tracked?.scanId;
  const target = tracked?.target;
  const trackScan = useCallback((id: string, label?: string) => {
    setTracked({ scanId: id, target: label });
  }, []);
  const { status, connectionStatus, eventReceived, applyStatus } =
    useScanEvents(scanId);
  useScanStatusFallback({
    scanId,
    status,
    connectionStatus,
    eventReceived,
    applyStatus,
  });
  const markScanCancelled = useCallback(
    (id: string) => {
      if (id === scanId) {
        applyStatus("CANCELADO");
      }
    },
    [scanId, applyStatus],
  );

  const value = useMemo<ScanActivity>(
    () => ({
      scanId,
      target,
      status,
      connectionStatus,
      finishedScanId:
        scanId && isTerminalScanStatus(status) ? scanId : undefined,
      trackScan,
      markScanCancelled,
    }),
    [scanId, target, status, connectionStatus, trackScan, markScanCancelled],
  );

  return (
    <ScanActivityContext.Provider value={value}>
      {children}
    </ScanActivityContext.Provider>
  );
}
