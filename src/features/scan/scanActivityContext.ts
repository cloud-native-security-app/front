/**
 * Context and hooks of the live scan activity (see `ScanActivityProvider`).
 * Kept apart from the provider component so fast refresh keeps working.
 */

import { createContext, useContext } from "react";

import type { ConnectionStatus, ScanStatus } from "../../api";

export interface ScanActivity {
  /** Id of the scan whose live status is being followed, if any. */
  scanId: string | undefined;
  /** Target the tracked scan was submitted for, when the caller provided it. */
  target: string | undefined;
  status: ScanStatus;
  connectionStatus: ConnectionStatus;
  /** The tracked scan id once it reached a terminal state; otherwise `undefined`. */
  finishedScanId: string | undefined;
  trackScan: (scanId: string, target?: string) => void;
}

export const ScanActivityContext = createContext<ScanActivity | undefined>(
  undefined,
);

/** Throws outside a `ScanActivityProvider`: `ScanForm` cannot work without it. */
export function useScanActivity(): ScanActivity {
  const context = useContext(ScanActivityContext);
  if (!context) {
    throw new Error("useScanActivity must be used inside ScanActivityProvider");
  }
  return context;
}

/** Tolerant variant for readers (history): `undefined` when no provider is mounted. */
export function useFinishedScanId(): string | undefined {
  return useContext(ScanActivityContext)?.finishedScanId;
}
