/**
 * Keeps the live scan (SSE) alive across section changes (feature
 * `sectioned-navigation`, SNV-03). `ScanForm` lives in the "Escanear"
 * section and `HistoryTable` in "Historial", so the subscription cannot
 * belong to the form: it would close as soon as the user navigates. The
 * provider owns the tracked scan id and its `useScanEvents` state, and
 * exposes `finishedScanId` (the tracked id once its status is terminal) so
 * the history can refetch immediately instead of waiting for the poll.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { ScanActivityContext, type ScanActivity } from "./scanActivityContext";
import { isTerminalScanStatus } from "./scanStatus";
import { useScanEvents } from "./useScanEvents";

export function ScanActivityProvider({ children }: { children: ReactNode }) {
  const [tracked, setTracked] = useState<
    { scanId: string; target: string | undefined } | undefined
  >(undefined);
  const scanId = tracked?.scanId;
  const target = tracked?.target;
  const trackScan = useCallback((id: string, label?: string) => {
    setTracked({ scanId: id, target: label });
  }, []);
  const { status, connectionStatus } = useScanEvents(scanId);

  const value = useMemo<ScanActivity>(
    () => ({
      scanId,
      target,
      status,
      connectionStatus,
      finishedScanId:
        scanId && isTerminalScanStatus(status) ? scanId : undefined,
      trackScan,
    }),
    [scanId, target, status, connectionStatus, trackScan],
  );

  return (
    <ScanActivityContext.Provider value={value}>
      {children}
    </ScanActivityContext.Provider>
  );
}
