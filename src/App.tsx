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
 *
 * `NetworkCredentialsManager` (feature `network_credentials_manager`, id 9)
 * se monta primero dentro del mismo `ProtectedRoute`, antes que `ScanForm`:
 * sin al menos una credencial de red configurada para el objetivo,
 * `POST /api/scans` siempre responde 422 en el Gateway real — hay que poder
 * configurar una antes de poder escanear con éxito.
 *
 * `LogoutButton` (feature `logout_button`, id 10) se monta primero de todo
 * dentro de `ProtectedRoute`: se autogatea por `useSession().status ===
 * "authenticated"` (nunca visible en loading/anonymous), así que su
 * posición exacta dentro del contenido protegido no importa — va primero
 * simplemente porque es la acción inversa al login, visible de inmediato.
 *
 * `HomePage` (feature `home_landing_page`, id 12) es el `anonymousView` de
 * `ProtectedRoute`: reemplaza el auto-redirect silencioso anterior por
 * contenido real con un CTA explícito. El `<h1>front</h1>` que antes vivía
 * fuera de `ProtectedRoute` (visible también para el visitante anónimo) se
 * mueve DENTRO de los `children` (rama autenticada): `HomePage` ya trae su
 * propia marca "front" en su diseño, así que un `<h1>front</h1>` sin
 * estilo por encima de ella quedaría duplicado.
 *
 * `<div className="app-shell--authenticated">` (feature
 * `unify_authenticated_theme`, id 17) envuelve TODO el contenido existente
 * de la rama autenticada, sin reestructurar su estado ni su lógica: es
 * puramente un contenedor que `src/index.css` usa para redefinir, en su
 * propio scope CSS, las mismas `--color-*` que ya leen de forma genérica
 * `HistoryTable`/`NetworkCredentialsManager`/`ReportView`/`LogoutButton`
 * (ver el comentario de ese archivo) — mueve el quiebre de tema claro/
 * oscuro al límite real de la app (público vs. autenticado) en vez de
 * dejarlo a mitad del dashboard como hacía `.scan-console` por sí solo.
 */

import { useState } from "react";

import { LogoutButton, ProtectedRoute, SessionProvider } from "./auth";
import { NetworkCredentialsManager } from "./features/credentials";
import { HistoryTable } from "./features/history";
import { HomePage } from "./features/home";
import { ReportView } from "./features/report";
import { ScanForm } from "./features/scan";

export function App() {
  const [selectedScanId, setSelectedScanId] = useState<string | undefined>(
    undefined,
  );

  return (
    <SessionProvider>
      <main>
        <ProtectedRoute anonymousView={<HomePage />}>
          <div className="app-shell--authenticated">
            <h1>front</h1>
            <LogoutButton />
            <NetworkCredentialsManager />
            <ScanForm />
            <HistoryTable onViewReport={setSelectedScanId} />
            {selectedScanId && <ReportView scanId={selectedScanId} />}
          </div>
        </ProtectedRoute>
      </main>
    </SessionProvider>
  );
}
