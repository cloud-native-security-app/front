/**
 * Keeps the live scan (SSE) alive across section changes (feature
 * `sectioned-navigation`, SNV-03). `ScanForm` lives in the "Escanear"
 * section and `HistoryTable` in "Historial", so the subscription cannot
 * belong to the form: it would close as soon as the user navigates. The
 * provider owns the tracked scan id and its `useScanEvents` state, and
 * exposes `finishedScanId` (the tracked id once its status is terminal) so
 * the history can refetch immediately instead of waiting for the poll.
 */

import { useMemo, useState, type ReactNode } from "react";

import { ScanActivityContext, type ScanActivity } from "./scanActivityContext";
import { isTerminalScanStatus } from "./scanStatus";
import { useScanEvents } from "./useScanEvents";

export function ScanActivityProvider({ children }: { children: ReactNode }) {
  const [scanId, setScanId] = useState<string | undefined>(undefined);
  const { status, connectionStatus } = useScanEvents(scanId);

  const value = useMemo<ScanActivity>(
    () => ({
      scanId,
      status,
      connectionStatus,
      finishedScanId:
        scanId && isTerminalScanStatus(status) ? scanId : undefined,
      trackScan: setScanId,
    }),
    [scanId, status, connectionStatus],
  );

  return (
    <ScanActivityContext.Provider value={value}>
      {children}
    </ScanActivityContext.Provider>
  );
}
