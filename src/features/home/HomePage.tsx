/**
 * Página de inicio para el visitante anónimo (feature `home_landing_page`,
 * id 12; ver docs/architecture.md, capa 2/8: `ProtectedRoute` la renderiza
 * como `anonymousView` cuando `useSession().status === "anonymous"`).
 *
 * Dirección visual "Signals & Traces" (acordada con el usuario vía la skill
 * `frontend-design`): consola técnica, con los tokens de color
 * globales de `src/index.css` (tema claro/oscuro),
 * Space Grotesk para titular/cuerpo e IBM Plex Mono para el panel técnico.
 * `LoginButton` (ya existente en `src/auth`) es el CTA — esta página nunca
 * reimplementa la navegación de login.
 */

// Solo el subset "latin" (cubre además vocales acentuadas y "ñ", suficiente
// para el copy en español de esta página) en vez de `/400.css` etc., que
// empaquetarían también cyrillic/greek/vietnamese sin necesidad — menos
// peso, mismo principio de self-hosted sin CDN de terceros.
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";

import { LoginButton } from "../../auth";
import { PRODUCT_NAME } from "../../copy";
import { ThemeToggle } from "../../theme";
import "./home.css";

/**
 * Contenido de ejemplo del panel "Escaneo en vivo": NUNCA proviene de
 * `submitScan`/`subscribeToScanEvents` ni de ninguna llamada real al
 * backend. Esta página se muestra a un visitante sin sesión, que no tiene
 * ningún escaneo propio que mostrar — son líneas fabricadas solo para
 * transmitir, visualmente, la idea de "estado de escaneo en tiempo real"
 * que el producto ofrece una vez autenticado.
 */
const EXAMPLE_LIVE_SCAN_LINES = [
  "10.4.18.12 → 22/tcp abierto ssh",
  "10.4.18.12 → 443/tcp abierto https",
  "10.4.18.44 → 3389/tcp filtrado rdp",
  "10.4.19.6 → 8080/tcp cerrado http-proxy",
  "10.4.19.6 → 5432/tcp abierto postgresql",
];

export function HomePage() {
  return (
    <div className="home-page">
      <div className="home-page__toolbar">
        <ThemeToggle />
      </div>
      <div className="home-page__shell">
        <div className="home-page__intro">
          <p className="home-page__brand">{PRODUCT_NAME}</p>
          <h1 className="home-page__headline">
            Analiza infraestructura antes de que alguien más lo haga.
          </h1>
          <p className="home-page__lede">
            {PRODUCT_NAME} encola el escaneo de una IP, sigue su estado en
            tiempo real y te muestra los hallazgos — sin paneles que adivinar.
          </p>
          <LoginButton label="Iniciar sesión" className="home-page__cta" />
          <ul className="home-page__capabilities">
            <li>Encolar — una IP objetivo, validada antes de enviarse.</li>
            <li>Verificar — estado en tiempo real, sin recargar la página.</li>
            <li>Revisar — hallazgos con su severidad.</li>
          </ul>
        </div>
        <div className="home-page__panel">
          <p className="home-page__panel-label">
            <span className="home-page__panel-dot" aria-hidden="true" />
            Escaneo en vivo
          </p>
          <ul className="home-page__panel-lines">
            {EXAMPLE_LIVE_SCAN_LINES.map((line) => (
              <li key={line} className="home-page__panel-line">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
