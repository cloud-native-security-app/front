/**
 * App mount point (docs/architecture.md, layer 8). `SessionProvider` wraps
 * everything; `ProtectedRoute` shows `HomePage` (with the session-expired
 * notice) to anonymous visitors on any path, and the sectioned app
 * (`AuthenticatedRoutes`: header + "Escanear", "Historial", "Objetivos")
 * once authenticated. `<div className="app-shell--authenticated">` scopes the
 * dark theme of `src/index.css` to the authenticated half of the app.
 *
 * The router itself is created outside (`src/main.tsx` uses
 * `BrowserRouter`, tests use `MemoryRouter`), so `App` stays testable at any
 * URL. History: features `scaffolding`, `auth_session`, `home_landing_page`
 * and `unify_authenticated_theme` built this shell on a single page; feature
 * `sectioned-navigation` split it into routed sections.
 */

import { ProtectedRoute, SessionExpiredNotice, SessionProvider } from "./auth";
import { ErrorBoundary } from "./components";
import { HomePage } from "./features/home";
import { AuthenticatedRoutes } from "./routes";

/**
 * `App` does not create a router: `src/main.tsx` wraps it in
 * `BrowserRouter` and tests in `MemoryRouter` (feature
 * `sectioned-navigation`).
 */
export function App() {
  return (
    <SessionProvider>
      <ErrorBoundary>
        <ProtectedRoute
          anonymousView={
            <main>
              <SessionExpiredNotice />
              <HomePage />
            </main>
          }
        >
          <div className="app-shell--authenticated">
            <AuthenticatedRoutes />
          </div>
        </ProtectedRoute>
      </ErrorBoundary>
    </SessionProvider>
  );
}
