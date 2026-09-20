# Implementación — feature 2 `api_client`

> Estado: implementación completa, **`feature_list.json` sigue en
> `"in_progress"`** — el cambio a `"done"` lo decide el `reviewer`, no este
> informe.

## Qué se implementó

### `src/api` (único módulo que conoce el Gateway)

- `src/api/types.ts`: tipos del wire format del Gateway copiados
  literalmente de `progress/explore_gateway_contract.md` (`MeResponse`,
  `ScanHistoryEntry`, `SubmitScanResponse`, `ScanResult`/`ScanPort`/
  `ScanVulnerability`, `ScanOutcomeEvent` discriminado por `status`), más
  `ApiError` (discriminado por `kind`: `network`, `unauthorized`,
  `not_found`, `not_ready`, `conflict`, `validation`, `unexpected`) y
  `ApiResult<T>` (`{ ok: true; value } | { ok: false; error }` — ninguna
  función de `src/api` rechaza su promesa por un error HTTP/red esperado,
  así ningún llamante puede "olvidar" un `.catch()`).
- `src/api/guards.ts`: guards de runtime (`unknown` + narrowing, sin
  `any`) para detectar un payload que no matchea el shape esperado y
  mapearlo a `ApiError { kind: "unexpected" }`.
- `src/api/config.ts` + `src/vite-env.d.ts`: `gatewayBaseUrl()` lee
  `import.meta.env.VITE_GATEWAY_BASE_URL` (tipada explícitamente en
  `vite-env.d.ts`, nunca hardcodeada), y `configureGatewayBaseUrl()` como
  escape hatch **solo para tests** (necesario porque el puerto del
  servidor de contrato es efímero, decidido en runtime — no se puede
  resolver con una sola variable de entorno estática de build).
- `src/api/httpClient.ts`: `performRequest()` (fetch + `credentials:
  "include"` + separación red-caída/HTTP-resuelto), `mapCommonErrorStatus()`
  (401/403→`unauthorized`, 404→`not_found`, 400→`validation`,
  resto→`unexpected`), `parseJson()` (nunca asume `await res.json()` en el
  camino de error — el Gateway real responde texto plano).
- `src/api/auth.ts`: `loginRedirectUrl()` (string, para navegación
  completa del navegador — nunca un `fetch`) y `getMe()`.
- `src/api/scans.ts`: `submitScan`, `getScanHistory`, `cancelScan` (202 →
  éxito, 409 → `conflict`, 404 → `not_found`).
- `src/api/report.ts`: `getReport()` — ver sección "Decisión sobre
  `getReport`" abajo.
- `src/api/scanEvents.ts`: `subscribeToScanEvents()` con `EventSource`
  nativo, `withCredentials: true`, callback de `ConnectionStatus`
  (`connecting|open|reconnecting|closed`); se auto-cierra tras un evento
  terminal (`completed`/`failed`) para no dejar a `EventSource`
  reintentando contra un stream ya agotado.
- `src/api/index.ts`: barrel público con las 7 funciones pedidas por
  `feature_list.json` id 2 + tipos.

### Servidor de contrato (`e2e/contract-server/`)

- `store.ts`: estado en memoria (sesiones sintéticas, scans con su guion
  de eventos SSE).
- `server.ts`: `node:http` puro (sin frameworks nuevos), implementa
  `/health`, `/auth/login` (302), `/api/me`, `/api/scans` (GET/POST),
  `/api/scans/:id/cancel`, `/api/scans/:id/events` (SSE), `/api/scans/:id/report`
  (propuesto, ver abajo), y `POST /__test__/session` (**no existe en el
  Gateway real** — crea una sesión sintética sin pasar por Google OIDC,
  documentado explícitamente en el propio código). Errores como texto
  plano, mismos status codes que documenta
  `progress/explore_gateway_contract.md`. `startContractServer(port)`
  reutilizable in-process desde Vitest y desde specs de Playwright (nunca
  se duplica un segundo servidor).
- `main.ts`: entrypoint standalone (`node e2e/contract-server/main.ts`)
  para un futuro `webServer` de Playwright — **no se wireó en
  `playwright.config.ts`** porque esta sesión tenía prohibido editar fuera
  de `src/`, `tests/`, `e2e/`; los tests e2e de esta feature arrancan el
  servidor programáticamente en `test.beforeAll` en vez de vía
  `webServer`. Queda documentado aquí para que una feature futura (con
  permiso de tocar `playwright.config.ts`) lo conecte a un flujo de UI
  completo.
- `nodeTestSession.ts`: polyfills **solo de test** (nunca importados desde
  `src/`): `EventSource` (de `undici`, Node no lo implementa) y un cookie
  jar transparente sobre el dispatcher global de `undici` (Node/jsdom no
  mantienen cookies entre llamadas `fetch`, ni siquiera con
  `credentials: "include"` — confirmado ejecutando un servidor real en
  este entorno). Sin esto no había forma de ejercer los flujos
  autenticados de `src/api` a través de sus funciones públicas (que, por
  diseño, nunca gestionan cookies manualmente).

### Tests

- `tests/api/*.test.ts` (30 tests, vitest): `auth`, `scans`, `report`,
  `scanEvents`, `config`, `errorMapping` (red caída + payload inesperado
  vía un `node:http` ad-hoc, permitido explícitamente por el criterio de
  aceptación), `guards`. Todos corren contra el servidor de contrato
  in-process (puerto efímero) o un servidor HTTP mínimo — nunca
  interceptando `fetch` a nivel de módulo.
- `e2e/api-contract.spec.ts` (Playwright, 2 tests): levanta el servidor de
  contrato como proceso real dentro de `test.beforeAll` y ejercita
  `src/api` de punta a punta (login sintético → submit → historial →
  reporte "not_ready" → eventos SSE → reporte listo → cancelación en
  conflicto; y un segundo flujo de cancelación 202→409).
- `tests/setup.ts`: instala el polyfill de sesión de Node antes de cada
  archivo de test.

## Decisiones tomadas

### `getReport(scanId)` — contrato especulativo (ya consultado con el usuario)

Documentado explícitamente en **tres lugares**: `src/api/report.ts` (JSDoc
de módulo), `e2e/contract-server/server.ts` (comentario de módulo) y aquí.
El Gateway real (`gateway`, repo hermano) **no tiene** ningún endpoint de
reporte hoy — RF-11 depende de `ms-analisis`, que ni siquiera existe como
repo (`progress/explore_gateway_contract.md` §Advertencias). Se implementó
`getReport()` como `GET /api/scans/{scanId}/report` reutilizando
literalmente el shape de `ScanResult` que el Gateway ya serializa en el
evento SSE `completed.result` — sin inventar campos nuevos. Mapeo de
errores: `404` → `not_found` (scan ajeno/inexistente, mismo patrón que el
resto de endpoints), `409` → `not_ready` (tipado explícito y distinguible
sin parsear texto, para el caso "existe pero no está `COMPLETADO`
todavía"). Integrar esto contra el Gateway real requiere que ese repo
(fuera del alcance de `front`) implemente primero este endpoint.

### `ApiResult<T>` en vez de rechazar la promesa

`docs/conventions.md` muestra `ApiError` como ejemplo pero no prescribe si
las funciones deben lanzar o retornar. Se eligió que **ninguna** función
de `src/api` rechace su promesa por un error HTTP/red esperado — todas
retornan `{ ok: true; value } | { ok: false; error: ApiError }`. Motivo:
"nunca... deja una promesa sin manejar" se cumple estructuralmente (no hay
`try/catch` que un llamante pueda olvidar), y sigue siendo un `ApiError`
tipado, no un string suelto.

### Cookie jar + `EventSource` para tests en Node (hallazgo propio, no solo el de la exploración previa)

`progress/explore_sse_contract_server.md` recomendaba `import { EventSource
} from "undici"` asumiendo (incorrectamente, verificado en esta sesión)
que sería un módulo *built-in* de Node — no existe `node:undici`; es la
dependencia transitiva `undici` (paquete npm, resuelta hoy vía otras
`devDependencies` como `vite`/`vitest`, versión `8.10.2`). Lo correcto
hubiera sido declararla explícita en `package.json` (evitar depender de
una dependencia "fantasma" no listada) — **no se hizo** porque esta
sesión tenía prohibido editar fuera de `src/`, `tests/`, `e2e/` y este
informe; `package.json`/`package-lock.json` no están en esa lista. Queda
como seguimiento explícito para el `reviewer`/una sesión futura con
permiso de tocar `package.json`: añadir `"undici"` a `devDependencies`
(ya instalada en `node_modules`, ningún cambio de comportamiento, solo
declarar la dependencia que ya se usa). Mientras tanto, `import "undici"`
en `e2e/contract-server/nodeTestSession.ts` funciona porque el paquete ya
está en `node_modules` — pero es frágil ante un futuro `npm dedupe`/cambio
de versión de alguna dependencia hermana que deje de traerlo.

Además, se descubrió que **ni Node ni jsdom mantienen un cookie jar entre
llamadas de `fetch`**, incluso con
`credentials: "include"` (confirmado ejecutando un servidor real: el
`Set-Cookie` de una respuesta nunca se reenvía en la siguiente petición) —
sin resolver esto no había forma de testear un flujo autenticado a través
de las funciones públicas de `src/api` (que nunca gestionan cookies
manualmente, por diseño de `docs/security-scope.md`). Se implementó un
interceptor de `undici` (`setGlobalDispatcher` + `Agent().compose(...)`)
que actúa como cookie jar transparente, **solo en `tests/setup.ts` y
`e2e/contract-server/nodeTestSession.ts`**, nunca en `src/`.

Un segundo hallazgo durante la implementación: sustituir el `handler` que
entrega `dispatch()` por un objeto nuevo (`{ ...handler, onResponseStart:
... }`) deja cualquier petición real colgada para siempre (confirmado:
timeouts consistentes en toda petición a un servidor real, mientras que
una conexión rechazada fallaba rápido) — el handler debe **mutarse
in-place**, no reemplazarse, porque en esta versión de `undici` conserva
estado/métodos que un spread no copia. Documentado en el propio código
(`nodeTestSession.ts`).

Un tercer hallazgo: bajo el entorno `jsdom` (el default del proyecto), el
polyfill de `EventSource` de `undici` construye sus eventos con `new
Event(...)` usando el `Event` global — que jsdom reemplaza por su propia
clase, y el `dispatchEvent` nativo de Node (del que hereda `EventSource`)
rechaza esa instancia (`"Received an instance of Event"`, mismo nombre,
distinta identidad). Solución: `tests/api/scanEvents.test.ts` y
`tests/api/report.test.ts` (los dos únicos archivos de esta feature que
ejercitan `subscribeToScanEvents`) corren en el entorno `// @vitest-environment
node` en vez del `jsdom` por defecto — no renderizan DOM, así que no
pierden cobertura, y evitan por completo el conflicto de clases.

## Resultado de la verificación

Ejecutado en este orden, todos en verde:

- `npm run typecheck` → sin errores.
- `npm run lint` → sin warnings.
- `npm run format:check` → sin diferencias (se corrió `npm run format`
  una vez para aplicar el estilo inicial).
- `npm run test -- --run` → **30/30 tests pasan** (8 archivos:
  `auth`, `scans`, `report`, `scanEvents`, `config`, `errorMapping`,
  `guards`, más el `App.test.tsx` de scaffolding).
- `npm run test:e2e` → **3/3 tests pasan** (el smoke test de scaffolding
  existente + los 2 nuevos de `e2e/api-contract.spec.ts`).
- `npm run build` → compila sin errores (15 módulos; `src/api` no se
  bundlea todavía porque ninguna UI lo importa aún — eso llega con
  `auth_session`/`scan_request_form`/etc.).
- `./init.sh` → `[OK] Entorno listo.`

## Archivos relevantes

- `src/api/{types,guards,config,httpClient,auth,scans,report,scanEvents,index}.ts`
- `src/vite-env.d.ts`
- `e2e/contract-server/{store,server,main,nodeTestSession}.ts`
- `e2e/api-contract.spec.ts`
- `tests/api/{testHelpers,auth,scans,report,scanEvents,config,errorMapping,guards}.{ts,test.ts}`
- `tests/setup.ts` (editado: instala el polyfill de sesión)

## No hecho (fuera de alcance, a propósito)

- No se tocó `playwright.config.ts` ni `vite.config.ts` ni `vitest.config.ts`
  ni `package.json`/`package-lock.json` (restricción explícita de esta
  sesión: solo `src/`, `tests/`, `e2e/` y este informe) — el `webServer`
  del servidor de contrato para un flujo de UI completo, y declarar
  `"undici"` explícitamente en `devDependencies` (ver sección de
  decisiones arriba), quedan pendientes de una sesión futura con permiso
  para editar esos archivos.
- No se implementó ningún formulario, hook de UI, histórico visual ni
  vista de reporte — eso es de las features `auth_session`,
  `scan_request_form`, `realtime_status`, `scan_history`, `report_view`.
- No se marcó la feature como `done` en `feature_list.json`.
