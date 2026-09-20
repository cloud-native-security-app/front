# Implementación — feature 3 `auth_session`

> Estado en `feature_list.json`: se deja en `in_progress` (no lo cambio yo,
> ver protocolo — decide el `reviewer`).

## Qué se implementó

### `src/auth` (nuevo)

- `sessionTypes.ts` — `SessionStatus` (`loading|authenticated|anonymous`),
  `SessionState { status, user }`, constantes `LOADING_SESSION`/
  `ANONYMOUS_SESSION`.
- `sessionContext.ts` — `SessionContext` (React context crudo, expuesto
  solo para poder inyectar un `SessionState` arbitrario en tests de
  componente sin pasar por red).
- `SessionProvider.tsx` — componente que llama a `getMe()` una vez al
  montar y expone el resultado (`authenticated`/`anonymous`) vía contexto;
  se suscribe a `onUnauthorized()` de `src/api` para limpiar el estado a
  `anonymous` ante un 401/403 de **cualquier** llamada posterior.
- `useSession.ts` — hook de lectura (`useContext` + guard de composición).
- `LoginButton.tsx` — botón que hace `window.location.href =
  loginRedirectUrl()` en el `onClick` (nunca `fetch`).
- `ProtectedRoute.tsx` — guard simple por composición: no renderiza
  `children` en `loading` ni en `anonymous`; en `anonymous` navega a
  `loginRedirectUrl()` vía `useEffect`. No usa ninguna librería de routing
  (ver "Decisión: sin librería de routing" abajo).
- `index.ts` — barrel actualizado (reemplaza el placeholder de
  `scaffolding`).

### `src/api` (extensión mínima, no reescritura)

- `unauthorized.ts` (nuevo) — pub/sub interno: `onUnauthorized(handler)` /
  `notifyUnauthorized()`. Único punto de acoplamiento entre `src/api` y
  `src/auth`, y va en un solo sentido (`src/api` nunca importa nada de
  `src/auth`).
- `httpClient.ts` — una línea añadida: `mapCommonErrorStatus` llama a
  `notifyUnauthorized()` en el caso 401/403, antes de devolver
  `{ kind: "unauthorized" }`. Afecta a `getMe`, `submitScan`,
  `getScanHistory`, `cancelScan`, `getReport` (todas las que ya usaban ese
  mapeo compartido). No toqué la firma ni el comportamiento observable de
  ninguna función existente — mismo `ApiResult`/`ApiError` de siempre, solo
  se añade un efecto secundario de notificación.
- `index.ts` — exporta `onUnauthorized`.
- **No toqué** `scanEvents.ts`: `EventSource` no expone el status HTTP a
  JS, así que un 401 en el canal SSE ya se refleja como
  `"closed"`/`"reconnecting"` vía `onStatusChange` (comportamiento previo,
  documentado en el propio archivo) — no puede alimentar
  `notifyUnauthorized`. Lo dejo anotado aquí como limitación conocida, no
  como omisión silenciosa.

## Decisión de diseño — mecanismo de notificación 401/403 (criterio 4)

Se optó por un **pub/sub interno de `src/api`** (`onUnauthorized`/
`notifyUnauthorized` en `src/api/unauthorized.ts`) en vez de, por ejemplo,
que cada función de `src/api` devolviera algo especial que `src/auth`
tuviera que inspeccionar manualmente tras cada llamada. Razones:

- Mantiene el límite de capas de `docs/architecture.md`: `src/api` sigue
  siendo el único módulo que conoce el contrato HTTP del Gateway;
  `src/auth` reacciona a un evento, nunca al revés (`src/api` no importa
  nada de `src/auth`).
- Cubre **cualquier** llamada futura que use `mapCommonErrorStatus`
  (`scan_request_form`, `scan_history`, `report_view` lo heredan gratis
  sin cambios adicionales) — no depende de que cada `src/features/*` se
  acuerde de llamar a `useSession`/revisar el error manualmente.
- Es un módulo de una responsabilidad, testeado de forma aislada
  (`tests/api/unauthorized.test.ts`) además de a través de
  `SessionProvider` (`tests/auth/SessionProvider.test.tsx`, caso "limpia la
  sesión ante un 401 de `getScanHistory()`", no solo de `getMe()`).

`ProtectedRoute` es quien decide **cuándo navegar** (en un `useEffect`
atado a `status === "anonymous"`), mientras que `SessionProvider`/
`onUnauthorized` solo limpian el estado en memoria. Esto es correcto hoy
porque no existe ninguna otra feature con UI todavía (todo lo que llama a
`src/api` estará, cuando exista, envuelto en un `ProtectedRoute`); lo dejo
explícito por si una feature futura necesita reaccionar a un 401 fuera de
un árbol protegido — en ese caso habría que revisar si además hace falta
un efecto de navegación en el propio `SessionProvider`.

## Decisión — sin librería de routing

`ProtectedRoute` es un componente de composición simple (envuelve
`children`), sin `react-router` ni ninguna otra dependencia nueva. No hizo
falta: la feature no pide un router completo, solo un guard, y
`docs/security-scope.md` exige justificar cada dependencia nueva antes de
añadirla. No se tocó `package.json`.

## Decisión — integración en `src/App.tsx`/`src/main.tsx`: **no se hizo, y es deliberado**

Evalué wire-ear `SessionProvider`/`ProtectedRoute` en el `App.tsx` real
(como sugiere `docs/architecture.md`, capa 8) y decidí **no hacerlo en esta
sesión**, para no romper una regla dura ("si tu cambio toca otra feature,
paras y lo reportas"). El motivo concreto:

- `src/api/config.ts#gatewayBaseUrl()` lanza si `VITE_GATEWAY_BASE_URL` no
  está configurada. En este entorno no hay ningún `.env` (está en
  `.gitignore`, y además crear uno en la raíz del repo cae fuera de
  `src/`/`tests/`/`e2e/`, que es mi único scope de escritura permitido).
- `e2e/scaffolding.spec.ts` (feature `scaffolding`, ya `done`) navega
  `page.goto("/")` contra el `webServer` de `playwright.config.ts`
  (`vite preview` sirviendo el build estático, sin `VITE_GATEWAY_BASE_URL`)
  y solo espera ver el heading `"front"`.
- Si `App.tsx` montara `SessionProvider`/`ProtectedRoute` de verdad,
  `getMe()` fallaría con `{kind:"network"}` (el `throw` de
  `gatewayBaseUrl()` queda atrapado por el `try/catch` de
  `performRequest`), el estado pasaría a `anonymous`, y `ProtectedRoute`
  llamaría a `loginRedirectUrl()` — esta función SÍ lanza sin capturar
  (`auth.ts` no la envuelve en try/catch), lo que rompería el render de
  `App` y, con ello, el smoke test de `scaffolding`. Arreglarlo exigiría
  tocar `vite.config.ts`/`playwright.config.ts`/`package.json` (prohibido
  para mí) o el spec de otra feature ya aprobada (también prohibido por la
  regla de "una sola feature por sesión").

En vez de eso, implementé y testeé `src/auth` de forma completa y aislada
(unit tests con el servidor de contrato real, más un **harness e2e
dedicado**, ver abajo) que ejercen los componentes REALES (no
reimplementaciones) en un navegador real. La integración en
`App.tsx`/`main.tsx` queda como una decisión explícita para una feature
futura (naturalmente, la primera que introduzca una ruta protegida real
con contenido de negocio, p. ej. `scan_request_form`), momento en el que
también habrá que decidir cómo se resuelve `VITE_GATEWAY_BASE_URL` para
build/preview de forma que no dependa de mi solución de test.

Marco esto explícitamente para que el `reviewer`/el usuario lo evalúen: si
se prefiere integrarlo ya en `App.tsx` a costa de ajustar
`e2e/scaffolding.spec.ts`, es una decisión de alcance que corresponde al
usuario, no algo que yo debía decidir unilateralmente en esta sesión.

## Tests

### Unitarios (`vitest`, servidor de contrato real, sin mocks de `src/api`)

- `tests/api/unauthorized.test.ts`: `onUnauthorized` notifica en un 401 de
  `getScanHistory()`; deja de notificar tras desuscribirse.
- `tests/auth/SessionProvider.test.tsx`:
  - `loading -> authenticated` cuando `getMe()` devuelve sesión activa
    (login sintético real contra el servidor de contrato).
  - `loading -> anonymous` cuando `getMe()` devuelve 401 (sin sesión).
  - Estando `authenticated`, tras invalidar la cookie y que
    `getScanHistory()` reciba 401, el estado pasa a `anonymous` (cubre el
    criterio 4 explícitamente, no solo vía `getMe()`).
- `tests/auth/ProtectedRoute.test.tsx`: no renderiza contenido protegido en
  `loading`; no renderiza contenido y navega a `${gateway}/auth/login` en
  `anonymous`; renderiza `children` en `authenticated`.
- `tests/auth/LoginButton.test.tsx`: click navega a
  `${gateway}/auth/login` vía asignación de `window.location.href`, sin
  llamar a `fetch`.

### E2E (`playwright`)

- `e2e/auth-session.spec.ts` (nuevo): arranca el servidor de contrato real
  (`startContractServer`, igual que `e2e/api-contract.spec.ts`) **y**,
  además, un servidor **Vite de desarrollo programático** (API pública de
  `vite`, `createServer`/`.listen()`/`.close()` — sin tocar
  `vite.config.ts`/`playwright.config.ts`/`package.json`) que sirve
  `e2e/authHarness/` (un montaje mínimo de los componentes REALES de
  `src/auth`) con `server.proxy` reenviando `/api`, `/auth`, `/__test__`
  hacia el servidor de contrato. Esto evita CORS (mismo origen desde el
  navegador, como en producción front+Gateway) sin tocar
  `e2e/contract-server/` ni añadir cabeceras CORS a esa infraestructura de
  la feature `api_client`.
  - `usuario_sin_sesion_es_redirigido_a_login_al_visitar_una_ruta_protegida`:
    navega al harness sin cookie, intercepta (`page.route`) la navegación a
    `/auth/login` para no depender de una red real hacia Google, y verifica
    que el navegador efectivamente navegó ahí y que el contenido protegido
    nunca apareció.
  - `usuario_con_sesion_ve_el_contenido_protegido`: crea una sesión
    sintética real (`POST /__test__/session`, comparte cookies con `page`
    vía `context.request`), navega al harness y verifica que se renderiza
    "Contenido protegido" con el email de la sesión.
  - `e2e/authHarness/index.html` + `main.tsx`: harness documentado como
    exclusivo de test, importa `src/auth` directamente (nunca duplica su
    lógica).
- Verifiqué que **no rompí** `e2e/api-contract.spec.ts` (feature 2) ni
  `e2e/scaffolding.spec.ts` (feature 1): los 5 specs e2e pasan juntos.

## Seguridad (docs/security-scope.md)

- Ningún archivo de esta feature lee/escribe `localStorage`,
  `sessionStorage`, ni una variable global con un token/cookie. El único
  dato de sesión manejado en memoria es `MeResponse` (`sub`/`email`/
  `name`), ya público por diseño (es la propia sesión del usuario).
  `SessionState` vive en un `useState` de React, sin persistencia.
- El login y la reacción a un 401/403 son siempre navegación completa
  (`window.location.href`), nunca `fetch`.
- Ningún `console.log`/`console.error` de esta feature imprime datos
  personales ni tokens.
- El harness e2e (`e2e/authHarness`) usa identidades sintéticas
  (`auth-e2e@example.test`) vía el endpoint de test del servidor de
  contrato — nunca una cuenta real de Google.

## Resultado de verificación

- `npm run typecheck` — OK, sin errores.
- `npm run lint` — OK, sin warnings (incluye `e2e/authHarness/main.tsx`,
  con dos `eslint-disable-next-line react-refresh/only-export-components`
  justificados en comentario: es un entry point de harness de test sin
  HMR real).
- `npm run format:check` — OK.
- `npm run test` — OK, 12 archivos / 39 tests (incluye los 6 tests nuevos
  de `src/auth` + `src/api/unauthorized`, más los ya existentes de
  `api_client`).
- `npm run test:e2e` — OK, 5/5 specs (`scaffolding`, `api-contract` x2,
  `auth-session` x2 nuevos).
- `npm run build` — OK, sin errores/warnings de TypeScript.
- `./init.sh` — `[OK] Entorno listo. Puedes empezar a trabajar.`

## Archivos tocados/creados

Nuevos:
- `src/api/unauthorized.ts`
- `src/auth/sessionTypes.ts`, `sessionContext.ts`, `SessionProvider.tsx`,
  `useSession.ts`, `LoginButton.tsx`, `ProtectedRoute.tsx`
- `tests/api/unauthorized.test.ts`
- `tests/auth/SessionProvider.test.tsx`, `ProtectedRoute.test.tsx`,
  `LoginButton.test.tsx`
- `e2e/auth-session.spec.ts`, `e2e/authHarness/index.html`,
  `e2e/authHarness/main.tsx`

Modificados (mínimo, sin romper contratos existentes):
- `src/api/httpClient.ts` (una línea: `notifyUnauthorized()` en 401/403)
- `src/api/index.ts` (exporta `onUnauthorized`)
- `src/auth/index.ts` (reemplaza el placeholder de `scaffolding`)

No tocados (fuera de mi scope, tal como se me indicó): `package.json`,
`vite.config.ts`, `playwright.config.ts`, `src/App.tsx`, `src/main.tsx`,
`src/routes/index.ts`, `feature_list.json` (queda en `in_progress`).

## Para el reviewer

Punto concreto a revisar con atención: la decisión de **no integrar**
`SessionProvider`/`ProtectedRoute` en `src/App.tsx`/`src/main.tsx` reales
(sección de arriba). Si se considera insuficiente y se prefiere la
integración real ya, implica decidir cómo resolver `VITE_GATEWAY_BASE_URL`
para build/preview (posiblemente tocando `vite.config.ts`/
`playwright.config.ts`, fuera de mi permiso en esta sesión) y ajustar
`e2e/scaffolding.spec.ts` — ninguna de las dos cosas las hice porque
tocarían otra feature ya `done`.
