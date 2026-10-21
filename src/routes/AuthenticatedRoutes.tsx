/**
 * Routes of the authenticated app (feature `sectioned-navigation`): header
 * plus the three sections. `/` and any unknown path go to "Escanear". The
 * report is a sub-route of the history (`/historial/:scanId`) so it can be
 * linked, reloaded and navigated with back/forward. After a change of
 * section, focus moves to that section's heading (SNV-04).
 */

import { useEffect, useRef } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { NetworkCredentialsManager } from "../features/credentials";
import { HistoryTable } from "../features/history";
import { ReportView } from "../features/report";
import { ScanActivityProvider, ScanForm } from "../features/scan";
import { SECTION_HISTORY } from "../copy";
import { AppHeader } from "./AppHeader";
import { SECTION_PATHS, sectionOf } from "./paths";

function HistorySection() {
  const { scanId } = useParams();
  const navigate = useNavigate();

  return (
    <>
      <section aria-label={SECTION_HISTORY}>
        <h2 tabIndex={-1} data-section-heading>
          {SECTION_HISTORY}
        </h2>
        <HistoryTable
          onViewReport={(id) => void navigate(`${SECTION_PATHS.history}/${id}`)}
        />
      </section>
      {scanId && <ReportView scanId={scanId} />}
    </>
  );
}

function useFocusSectionHeadingOnNavigation(): void {
  const section = sectionOf(useLocation().pathname);
  const previous = useRef(section);

  useEffect(() => {
    if (previous.current === section) {
      return;
    }
    previous.current = section;
    document.querySelector<HTMLElement>("[data-section-heading]")?.focus();
  }, [section]);
}

export function AuthenticatedRoutes() {
  useFocusSectionHeadingOnNavigation();

  return (
    <ScanActivityProvider>
      <AppHeader />
      <main>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={SECTION_PATHS.scan} replace />}
          />
          <Route path={SECTION_PATHS.scan} element={<ScanForm />} />
          <Route path={SECTION_PATHS.history} element={<HistorySection />} />
          <Route
            path={`${SECTION_PATHS.history}/:scanId`}
            element={<HistorySection />}
          />
          <Route
            path={SECTION_PATHS.targets}
            element={<NetworkCredentialsManager />}
          />
          <Route
            path="*"
            element={<Navigate to={SECTION_PATHS.scan} replace />}
          />
        </Routes>
      </main>
    </ScanActivityProvider>
  );
}
