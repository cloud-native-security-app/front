# Implementación — feature 4 `scan_request_form`

> Estado en `feature_list.json`: se deja en `in_progress` (no lo cambio yo,
> ver protocolo — decide el `reviewer`).

## Pieza 1 — fix de imports en `e2e/contract-server/`

- `e2e/contract-server/main.ts`: `from "./server"` → `from "./server.ts"`.
- `e2e/contract-server/server.ts`: `from "./store"` → `from "./store.ts"`.
- No toqué los `import type { ... } from "../../src/api/types"` (type-only,
  se eliminan en compilación, nunca se resuelven en runtime).

Verificado aislado antes de seguir (tal como pedía el encargo): arranqué
`CONTRACT_SERVER_PORT=4310 node e2e/contract-server/main.ts` en background,
`curl http://127.0.0.1:4310/health` respondió `ok`, maté el proceso.

## Pieza 2 — `SessionProvider`/`ProtectedRoute` en `App.tsx`/`main.tsx` reales

- `src/App.tsx` ahora monta `SessionProvider` envolviendo todo; dentro,
  `<h1>front</h1>` queda **fuera** de `ProtectedRoute` (cabecera persistente
  del shell, satisface el smoke test de `scaffolding` sin depender del
  estado de sesión), y `ProtectedRoute` envuelve el `ScanForm` nuevo.
  `src/main.tsx` no necesitó cambios (sigue montando `<App />` tal cual).
- `e2e/scaffolding.spec.ts` (ajuste explícitamente autorizado por el
  líder): añadido un `test.beforeEach` que crea una sesión sintética real
  vía `context.request.post("/__test__/session", ...)` (mismo patrón que
  `e2e/auth-session.spec.ts`, usando `context.request` y no el `request` de
  nivel de test para que la cookie viaje con la navegación real de `page`)
  antes de `page.goto("/")`. La aserción del test (heading "front" visible)
  no cambió; solo se le da una sesión válida para que `ProtectedRoute` no
  redirija a `/auth/login` y no haya una carrera de timing no determinista.
  Documentado con un comentario de cabecera que explica el porqué,
  referenciando esta feature.
- `tests/App.test.tsx` reescrito para ejercer el `App` real (antes solo
  renderizaba el placeholder sin `SessionProvider`): dos casos, contra el
  servidor de contrato real (`useContractServer`, sin mocks de `src/api`,
  mismo patrón que `tests/auth/*`):
  - `renders_the_persistent_heading_and_redirects_to_login_when_anonymous`:
    heading visible de inmediato; tras `waitFor`, `ProtectedRoute` asignó
    `window.location.href` a `${gatewayBaseUrl()}/auth/login` (stub de
    `window.location`, mismo patrón que `tests/auth/ProtectedRoute.test.tsx`).
  - `renders_the_scan_form_inside_the_protected_route_when_authenticated`:
    con sesión sintética, el heading sigue visible y el `ScanForm` (campo
    "IP o rango a escanear") aparece dentro del `ProtectedRoute`.
- No añadí ninguna librería de routing: sigue sin hacer falta para una sola
  ruta protegida en la raíz (misma decisión ya tomada en `auth_session`).

## Pieza 3 — feature de negocio `scan_request_form`

### `src/features/scan` (nuevo)

- `validateScanTarget.ts` — validador puro (sin IO): reconoce IPv4
  (`192.168.1.10`) y CIDR (`10.0.0.0/24`, prefijo 0-32) válidos; rechaza
  cualquier otra entrada con un mensaje específico según el tipo de fallo
  (entrada vacía, número de octetos incorrecto, octeto no numérico, octeto
  fuera de rango, más de una barra, prefijo CIDR no numérico, prefijo CIDR
  fuera de rango) — nunca un genérico "inválido".
- `ScanForm.tsx` — formulario controlado: usa `validateScanTarget` en cada
  cambio de input; el botón de envío está `disabled` mientras la entrada no
  es válida o hay una petición en curso, y el error de validación se
  muestra inline (`role="alert"`) solo si el usuario ya escribió algo (no
  en el formulario recién montado, vacío). Al enviar (solo posible si
  `validation.valid`), llama a `submitScan(target.trim())` de `src/api`
  (reutilizado, no reimplementado); mientras la promesa está pendiente el
  botón muestra "Encolando…" y sigue deshabilitado. Éxito → `role="status"`
  con el `scanId` devuelto de inmediato. Error → `role="alert"` con un
  mensaje explícito por tipo (`network`, `unauthorized`, `validation` con
  el mensaje del Gateway, `unexpected` con el status, y un mensaje genérico
  solo para variantes de `ApiError` no listadas explícitamente — hoy
  `not_found`/`conflict`/`not_ready`, que `submitScan` nunca produce según
  su propio JSDoc, pero el `switch` los cubre sin `any`).
- `index.ts` — barrel (`ScanForm`, `validateScanTarget`, `TargetValidation`).

### `src/features/index.ts`

Comentario actualizado para reflejar que `features/scan` ya existe (antes
decía "se crea en la feature scan_request_form", ahora referencia `./scan`
directamente). Sin cambios de comportamiento.

## Tests

### Unitarios (`vitest`)

- `tests/features/scan/validateScanTarget.test.ts` (criterio 1 y 5): IP
  válida, CIDR válido, prefijo máximo `/32`, recorte de espacios; y casos
  inválidos con su mensaje específico: vacío, menos de 4 octetos, octeto
  fuera de rango, octeto no numérico, más de una barra, prefijo no
  numérico, prefijo fuera de rango — más un test explícito de que los
  mensajes de fallos distintos no son iguales entre sí (evita que alguien
  "optimice" el validador hacia un mensaje genérico compartido).
- `tests/features/scan/ScanForm.test.tsx` (criterio 6), contra el servidor
  de contrato real (`useContractServer`, `loginAsSyntheticUser`,
  `clearNodeTestSessionCookies` — mismo patrón que `tests/api/`/`tests/auth/`,
  sin mocks de `src/api`):
  - entrada inválida → botón deshabilitado, error inline visible, y un
    `vi.spyOn(globalThis, "fetch")` confirma que un click sobre el botón
    deshabilitado nunca dispara `fetch` (nunca llega a `submitScan`).
  - entrada válida + sesión activa → tras el click, aparece
    `role="status"` con "Escaneo encolado. ID: ...".
  - sin sesión (submit falla con 401) → aparece `role="alert"` con "Tu
    sesión ya no es válida...".

### E2E (`playwright`)

- `e2e/scan-request-form.spec.ts` (criterio 7): contra el `webServer` real
  de `playwright.config.ts` (build de producción + `vite preview` proxeado
  al servidor de contrato), con sesión sintética real vía
  `context.request.post("/__test__/session", ...)` antes de `page.goto("/")`
  (mismo patrón que el ajuste de `e2e/scaffolding.spec.ts`). Llena el campo
  "IP o rango a escanear" con una IP válida, hace click en "Escanear" y
  verifica que aparece el `scanId` en pantalla — ejercita el `App.tsx` real
  integrado, no un harness aparte.

## Decisiones de diseño

- **Mensaje inline solo con input no vacío**: evita mostrar un error en un
  formulario recién montado y vacío (mejor UX); no relaja el criterio 2
  (con cualquier entrada no vacía inválida, el error se muestra y el envío
  queda deshabilitado).
- **Reseteo del estado de envío al editar el input**: si el usuario edita
  el campo tras un error/éxito previo, `submitState` vuelve a `idle` — evita
  dejar un `scanId`/error obsoleto visible junto a una entrada ya distinta
  (parte del criterio 4, "sin dejar el formulario en un estado ambiguo").
- **No se tocó `src/api`**: `submitScan` se reutiliza tal cual (feature
  `api_client`, ya `done`); ningún tipo ni comportamiento de esa capa
  cambió.
- **Sin dependencias nuevas**: no se tocó `package.json` (fuera de mi
  alcance autorizado); no hizo falta ninguna librería nueva para el
  formulario ni el validador.

## Seguridad (`docs/security-scope.md`)

- Ningún archivo nuevo/modificado de esta sesión lee/escribe
  `localStorage`/`sessionStorage` ni loggea con `console.*`
  (`grep -rn "localStorage\|sessionStorage" src/ e2e/ tests/` y
  `grep -rn "console\.log" src/` sin resultados).
- `ScanForm` nunca maneja tokens/cookies: el único dato que toca es el
  `target` (texto libre del propio analista) y el `scanId`/mensaje de error
  que devuelve `src/api`, ya tipado.
- Ningún `any`/`@ts-ignore` nuevo (`grep` sin resultados en los archivos de
  esta feature).
- El e2e nuevo usa una identidad sintética (`scan-form-e2e@example.test`),
  nunca una cuenta real de Google — mismo patrón que las features previas.

## Resultado de verificación (en orden, tal como pedía el encargo)

- `npm run typecheck` → OK, sin errores.
- `npm run lint` → OK, sin warnings.
- `npm run format:check` → OK, sin diferencias (tras `prettier --write`
  sobre los 5 archivos nuevos que llegaron sin formatear).
- `npm run test` → OK, 14 archivos / 55 tests (antes 12/39; +2 tests de
  `App.test.tsx` reescrito, +11 de `validateScanTarget.test.ts`, +3 de
  `ScanForm.test.tsx`).
- `npm run build` → OK, sin errores/warnings de TypeScript.
- `npm run test:e2e` → OK, 6/6 specs: `scaffolding` (1, con la sesión
  sintética nueva), `api-contract` (2, sin cambios), `auth-session` (2, sin
  cambios), `scan-request-form` (1, nuevo). Confirmado que ninguno de los
  specs previos se rompió con la integración real de `App.tsx`.
- `./init.sh` → `[OK] Entorno listo. Puedes empezar a trabajar.`

## Archivos tocados/creados

Nuevos:
- `src/features/scan/validateScanTarget.ts`, `ScanForm.tsx`, `index.ts`
- `tests/features/scan/validateScanTarget.test.ts`, `ScanForm.test.tsx`
- `e2e/scan-request-form.spec.ts`

Modificados:
- `e2e/contract-server/main.ts`, `server.ts` (fix de 2 líneas, pieza 1)
- `src/App.tsx` (integración real de `SessionProvider`/`ProtectedRoute`)
- `src/features/index.ts` (comentario, sin cambio de comportamiento)
- `tests/App.test.tsx` (reescrito contra el `App` real)
- `e2e/scaffolding.spec.ts` (sesión sintética antes de navegar, ajuste
  autorizado)
- `progress/current.md` (plan de esta sesión)

No tocados (fuera de mi scope): `package.json`. `vite.config.ts`,
`playwright.config.ts`, `init.sh`, `.env.example` ya venían modificados por
el líder antes de despacharme (verificados en verde, no los reabrí).

## Para el reviewer

Puntos concretos a revisar con atención:
1. El ajuste a `e2e/scaffolding.spec.ts` — confirmar que la aserción
   original (heading visible) no cambió y que el uso de `context.request`
   (no `request`) es necesario para que la cookie de sesión llegue a la
   navegación de `page`.
2. `tests/App.test.tsx` reescrito por completo (antes no usaba
   `SessionProvider` en absoluto) — confirmar que sigue cubriendo el
   criterio original de `scaffolding` (heading visible) además de los dos
   casos nuevos de esta feature.
3. Los mensajes de error específicos de `validateScanTarget` — confirmar
   que cumplen el criterio "no un genérico 'inválido'" de forma que un
   futuro cambio no los colapse accidentalmente en un solo mensaje.
