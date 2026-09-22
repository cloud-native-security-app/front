/**
 * Setup global de vitest: extiende `expect` con los matchers de
 * @testing-library/jest-dom para aserciones de contenido en el DOM, e
 * instala los polyfills de sesión/EventSource que necesitan los tests de
 * `src/api` contra el servidor de contrato (ver
 * `e2e/contract-server/nodeTestSession.ts` para el detalle y el porqué).
 */
import "@testing-library/jest-dom/vitest";

import { installNodeTestSessionSupport } from "../e2e/contract-server/nodeTestSession";

installNodeTestSessionSupport();
