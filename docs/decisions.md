# Decisiones

Registro breve de decisiones tomadas durante el desarrollo inicial (17
features). Formato: contexto, decisión, consecuencia.

## D-01 Cliente del Gateway tipado y sin excepciones

- **Contexto:** `src/api` es el único módulo que conoce la URL y el contrato del Gateway.
- **Decisión:** las funciones devuelven `ApiResult<T>`/`ApiError` tipado; los errores del Gateway llegan como texto plano (no JSON), por lo que el código de estado es la señal principal. La URL sale de `VITE_GATEWAY_BASE_URL`, nunca hardcodeada.
- **Consecuencia:** ninguna función lanza strings sueltos; la UI mapea `kind` a mensajes.

## D-02 Servidor de contrato para tests

- **Contexto:** el Gateway real vive en otro repo y no se puede levantar aquí.
- **Decisión:** `e2e/contract-server/` (`node:http` nativo) implementa los endpoints HTTP y el SSE del Gateway. Lo usan Vitest (in-process) y Playwright. No se mockea `fetch` a nivel de módulo, salvo casos intencionalmente ajenos al contrato (JSON malformado).
- **Consecuencia:** es una aproximación provisional; debe actualizarse si cambia el contrato real. `undici` se declara como devDependency por los polyfills de test.

## D-03 Endpoint de reporte especulativo

- **Contexto:** el Gateway no expone endpoint de reporte (RF-11 depende de `ms-analisis`, que no existe como repo).
- **Decisión:** `getReport(scanId)` consume `GET /api/scans/{scanId}/report`, que reutiliza el shape de `ScanResult` del evento SSE `completed`. Documentado como no confirmado.
- **Consecuencia:** debe convertirse en una feature del Gateway. El 409 se tipa como `not_ready`.

## D-04 Sesión por cookie HttpOnly y 401 global

- **Decisión:** el estado de sesión sale de `GET /api/me`; login y reacción a 401/403 son navegación completa (`window.location.href`). Un pub/sub unidireccional (`src/api/unauthorized.ts`) permite que cualquier 401/403 limpie la sesión sin que `src/api` importe de `src/auth`. Nada se persiste en `localStorage`/`sessionStorage`.
- **Consecuencia:** `ProtectedRoute` recibe `anonymousView` obligatoria para no redirigir en silencio a visitantes anónimos.

## D-05 Estado en tiempo real por SSE

- **Decisión:** `EventSource` nativo con `withCredentials: true`, sin reimplementar la reconexión; la cancelación es un `POST` aparte.
- **Consecuencia:** en tests de componente con jsdom se usa un `fetch` al mismo endpoint de eventos drenado con `response.text()`, porque `EventSource` choca con jsdom.

## D-06 Navegación sin router

- **Decisión:** estado levantado en `App.tsx` (p. ej. "Ver reporte" sube el `scanId`) en lugar de `react-router`.
- **Consecuencia:** menos dependencias; reevaluar si crece el número de vistas.

## D-07 Reporte sin JSON crudo ni HTML inyectado

- **Decisión:** el reporte se muestra estructurado; el JSON solo existe en el archivo exportado (`Blob` + object URL). El texto del backend se renderiza como texto JSX, nunca con `dangerouslySetInnerHTML` (hay un test con `<script>` literal).

## D-08 Contenedor y CSP

- **Decisión:** `Dockerfile` multi-stage (`node:22-bookworm-slim` builder, `nginx:1.27-alpine` runtime, usuario no-root `nginx`), imágenes fijadas por tag y digest. `VITE_GATEWAY_BASE_URL` es build-arg obligatorio y además fija `connect-src` en la CSP (`default-src 'none'`, sin `unsafe-inline`, `font-src 'self'`).
- **Consecuencia:** la imagen queda atada a un Gateway concreto en build. Mejora futura: configuración en runtime.

## D-09 Credenciales de red y logout

- **Decisión:** `src/api/networkCredentials.ts` consume `GET/POST /api/network-credentials` y `DELETE /api/network-credentials/:id`; el botón de logout llama a `POST /auth/logout`. Sin credenciales, `POST /api/scans` responde 422.

## D-10 Identidad visual "Signals & Traces"

- **Decisión:** consola técnica oscura, acento cian único, Space Grotesk + IBM Plex Mono self-hosted (sin CDN). Los valores de color se comparten entre la home, `ScanForm` y el resto del dashboard autenticado (tema unificado en la feature 17), con contraste WCAG AA o superior y respeto de `prefers-reduced-motion`.

## D-11 Fetch sin caché

- **Decisión:** `performRequest` usa `cache: "no-store"` para que un `GET /api/me` con 200 cacheado no sobreviva al logout.

## D-12 Polling del histórico

- **Decisión:** `HistoryTable` hace polling cada 7 s mientras haya entradas `PENDIENTE`/`EN_PROGRESO`, para cubrir cortes del SSE. En tests se fakean solo `setInterval`/`clearInterval`; fakear `setTimeout` bloquea `fetch`/`undici`.

## D-13 Estabilidad de tests con `userEvent`

- **Contexto:** `userEvent.type` sin `delay: null` acumula tiempo y supera el timeout de 5 s de Vitest con la suite en paralelo.
- **Decisión:** `userEvent.setup({ delay: null })` en `NetworkCredentialForm.test.tsx`.
- **Pendiente:** el mismo patrón aparece en `ScanForm.test.tsx` y `HomePage.test.tsx`.

## D-14 Entorno

- `.gitattributes` fuerza `eol=lf` (CRLF por `core.autocrlf` rompía scripts).
- Los e2e requieren Chromium de Playwright instalado; no se sustituyen por mocks.
- Un `.env.local` rompe tests unitarios porque Vitest lo carga.
