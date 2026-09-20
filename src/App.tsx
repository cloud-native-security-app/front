/**
 * Punto de montaje de la aplicación (ver docs/architecture.md, capa 8).
 * `SessionProvider` envuelve toda la app; el `<h1>front</h1>` es una
 * cabecera persistente del shell, montada FUERA de `ProtectedRoute` a
 * propósito: es el smoke test de la feature `scaffolding`
 * (`e2e/scaffolding.spec.ts`) y debe seguir visible sin depender del
 * estado de sesión. El contenido de negocio (`ScanForm`, RF-02/RF-03/RF-04)
 * sí exige sesión activa, por eso vive dentro de `ProtectedRoute` (ver
 * `feature_list.json`, feature `scan_request_form`, id 4 — primera feature
 * que integra `SessionProvider`/`ProtectedRoute` en la app real). El
 * histórico (`HistoryTable`, feature `scan_history`, id 6, RF-13/RF-14)
 * vive dentro del mismo `ProtectedRoute`, junto a `ScanForm` — no se
 * introduce routing nuevo, mismo principio ya aplicado en
 * `auth_session`/`scan_request_form`: no hace falta una URL separada
 * todavía.
 *
 * El reporte de un escaneo (`ReportView`, feature `report_view`, id 7,
 * RF-11) sigue el mismo principio: no hay `react-router` ni una URL
 * propia para "detalle de un escaneo". En vez de eso, `selectedScanId` es
 * el único estado levantado aquí — se fija con la acción "Ver reporte" de
 * `HistoryTable` (mismo patrón que `onCancel`, ver
 * `src/features/history/HistoryTableView.tsx`) y `ReportView` solo se
 * monta dentro del mismo `ProtectedRoute` cuando hay una selección.
 */

import { useState } from "react";

import { ProtectedRoute, SessionProvider } from "./auth";
import { HistoryTable } from "./features/history";
import { ReportView } from "./features/report";
import { ScanForm } from "./features/scan";

export function App() {
  const [selectedScanId, setSelectedScanId] = useState<string | undefined>(
    undefined,
  );

  return (
    <SessionProvider>
      <main>
        <h1>front</h1>
        <ProtectedRoute>
          <ScanForm />
          <HistoryTable onViewReport={setSelectedScanId} />
          {selectedScanId && <ReportView scanId={selectedScanId} />}
        </ProtectedRoute>
      </main>
    </SessionProvider>
  );
}
