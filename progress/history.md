# Bitácora histórica (append-only)

> Cada vez que se cierra una sesión, su resumen se añade aquí.
> No edites entradas anteriores. Solo añades al final.

---

_El arnés (`AGENTS.md`, `feature_list.json`, `docs/`, `CHECKPOINTS.md`,
`.claude/agents/`) se estableció replicando el patrón de `broker`,
`nmap-service` y `user-service`, adaptado al alcance de `front` (SPA React +
TypeScript + Vite que habla solo con el Gateway)._

## Sesión 2026-09-19 — Feature 1: scaffolding

- **Feature:** `1 - scaffolding` — Scaffolding del proyecto React + TypeScript + Vite.
- **Agente:** leader (orquestó `implementer` + `reviewer`).
- **Resultado:** `done`.

Resumen: se inicializó el proyecto con Vite + React + TypeScript estricto
(`tsconfig.json` con `"strict": true` y flags adicionales), ESLint (flat
config con `typescript-eslint`, `eslint-plugin-react`, `react-hooks`,
`react-refresh`, `eslint-config-prettier`) y Prettier explícito
(`.prettierrc.json`). Estructura base creada: `src/{api,auth,features,
components,routes}` (cada uno con `index.ts` documentado vía JSDoc sobre su
responsabilidad futura), `tests/` (vitest + Testing Library) y `e2e/`
(playwright, apuntando a `npm run preview` como servidor local real).
Scripts de `package.json`: `dev`, `build`, `typecheck`, `lint`,
`format:check`, `test`, `test:e2e` — todos verificados en verde de forma
independiente por el `reviewer` (no solo por el `implementer`).

No se introdujo lógica de negocio de otras features ni dependencias de
negocio prematuras (router, fetching, etc.), coherente con
`docs/architecture.md`. Sin hallazgos de seguridad (sin `localStorage`,
`dangerouslySetInnerHTML`, ni manejo de tokens) — fuera de alcance de esta
feature de todas formas.

Detalle completo: `progress/impl_scaffolding.md` y
`progress/review_scaffolding.md` (veredicto: `approved`, sin cambios
requeridos).

Pendiente para la próxima sesión: elegir la siguiente feature `pending`
(id 2, `api_client`) siguiendo el protocolo de `AGENTS.md`.

## Sesión 2026-09-20 — Feature 2: api_client

- **Feature:** `2 - api_client` — Cliente tipado del Gateway y servidor de
  contrato para tests.
- **Agente:** leader (orquestó 2 `Explore`/`general-purpose` en paralelo →
  `implementer` → `reviewer`; tarea "compleja" según la tabla de escalado).
- **Resultado:** `done`.

Resumen: se investigó primero el contrato real del Gateway (repo hermano,
ya implementado con 11 features `done`) y el patrón recomendado de
servidor de contrato/SSE — hallazgos en `progress/explore_gateway_contract.md`
y `progress/explore_sse_contract_server.md`. Se detectó que el Gateway
real **no tiene endpoint de reporte** (RF-11 depende de `ms-analisis`, que
no existe como repo); se consultó al usuario, que decidió proceder
implementando `getReport(scanId)` contra un endpoint propuesto
(`GET /api/scans/{scanId}/report`) que reutiliza literalmente el shape de
`ScanResult` que el Gateway ya serializa en el evento SSE `completed`,
documentado explícitamente como especulativo/no confirmado en el Gateway
real (seguimiento fuera de alcance de `front`: debería convertirse en una
feature del repo `gateway`).

Se implementó `src/api` (7 funciones tipadas: `getMe`, `submitScan`,
`getScanHistory`, `cancelScan`, `subscribeToScanEvents`, `getReport`,
`loginRedirectUrl`) con `ApiResult<T>`/`ApiError` tipado (ninguna función
lanza string suelto ni deja promesa sin manejar), URL del Gateway leída de
`VITE_GATEWAY_BASE_URL` (nunca hardcodeada), manejo correcto de errores
como texto plano (no JSON, confirmado contra el contrato real), y
`EventSource` nativo con `withCredentials: true` exponiendo estado de
conexión sin reimplementar la reconexión. Servidor de contrato en
`e2e/contract-server/` (`node:http` nativo, sin dependencias nuevas de
framework), reutilizado in-process tanto por Vitest (30 tests) como por
Playwright (2 tests e2e). El leader añadió `"undici": "8.10.2"` a
`devDependencies` (dependencia usada por los polyfills de test, antes
transitiva/no declarada) tras el informe del implementer, verificado sin
cambios inesperados en el árbol de dependencias.

Sin hallazgos de seguridad (sin tokens/cookies en `src/`, sin `any`/
`@ts-ignore` sin justificar). Observación no bloqueante para features
futuras: no volcar `ApiError.message` (texto crudo del Gateway) tal cual
en la UI sin decidir qué se muestra al usuario.

Detalle completo: `progress/impl_api_client.md` y
`progress/review_api_client.md` (veredicto: `approved`, sin cambios
requeridos).

Pendiente para la próxima sesión: elegir la siguiente feature `pending`
(id 3, `auth_session`) siguiendo el protocolo de `AGENTS.md`. Leer
`docs/security-scope.md` antes de tocar login/sesión (regla ya aplicable
a esa feature).

## Sesión 2026-09-20 — Feature 3: auth_session

- **Feature:** `3 - auth_session` — Sesión y rutas protegidas.
- **Agente:** leader (orquestó `implementer` + `reviewer`, sin explorers:
  el contrato del Gateway ya estaba documentado desde la feature 2).
- **Resultado:** `done`.

Resumen: se implementó `src/auth` (`SessionProvider`, `useSession`,
`ProtectedRoute`, `LoginButton`) construido sobre `src/api` ya existente
(`getMe`, `loginRedirectUrl`), sin duplicar lógica. Para el criterio "un
401/403 de **cualquier** llamada de `src/api` limpia la sesión" (no solo
`getMe()`), se añadió un pub/sub interno de una sola dirección
(`src/api/unauthorized.ts`: `onUnauthorized`/`notifyUnauthorized`,
enganchado en `httpClient.ts#mapCommonErrorStatus`) — `src/api` nunca
importa de `src/auth`, respetando el límite de capas de
`docs/architecture.md`. El login y la reacción a un 401/403 son siempre
navegación completa del navegador (`window.location.href`), nunca
`fetch`. Sin tokens/credenciales persistidas (`localStorage`/
`sessionStorage`), único dato en memoria es `MeResponse` vía `useState`.

Decisión de alcance explícita del implementer, verificada y aceptada por
el reviewer: **no se integró** `SessionProvider`/`ProtectedRoute` en
`src/App.tsx`/`src/main.tsx` reales en esta sesión, porque hacerlo exigía
resolver `VITE_GATEWAY_BASE_URL` para build/preview (tocando
`vite.config.ts`/`playwright.config.ts`/`package.json`, fuera del alcance
permitido) y rompería `e2e/scaffolding.spec.ts` (feature 1, ya `done`).
Los criterios de aceptación de la feature 3 no exigen esa integración
literalmente, y `docs/architecture.md` la ubica en la capa 8 junto con el
router (aún inexistente). En su lugar, `src/auth` se probó completo con
sus componentes reales: unitarios contra el servidor de contrato real
(sin mocks de `src/api`) y un harness e2e dedicado
(`e2e/authHarness/`, documentado como exclusivo de test, Vite programático
+ proxy hacia el servidor de contrato) que monta los componentes reales
sin duplicar su lógica. Los 5 specs e2e y 39 tests unitarios pasan juntos.

Queda como decisión pendiente para la próxima feature con UI de negocio
real (naturalmente `scan_request_form`, la primera en necesitar una ruta
protegida real): cómo resolver `VITE_GATEWAY_BASE_URL` para build/preview
al integrar `SessionProvider`/`ProtectedRoute` en `App.tsx`/`main.tsx` de
verdad.

Detalle completo: `progress/impl_auth_session.md` y
`progress/review_auth_session.md` (veredicto: `approved`, sin cambios
requeridos).

Pendiente para la próxima sesión: elegir la siguiente feature `pending`
(id 4, `scan_request_form`) siguiendo el protocolo de `AGENTS.md`. Esa
feature probablemente deba resolver la integración de `App.tsx`/`main.tsx`
mencionada arriba.

## Sesión 2026-09-20 — Feature 4: scan_request_form

- **Feature:** `4 - scan_request_form` — Formulario de nueva solicitud de
  escaneo.
- **Agente:** leader (investigación e infraestructura propia + 1
  `implementer` + 1 `reviewer`; tarea "compleja").
- **Resultado:** `done`.

Resumen: esta fue la primera feature en integrar de verdad
`SessionProvider`/`ProtectedRoute` (feature `auth_session`) en
`src/App.tsx` real, decisión explícitamente diferida hasta este punto. El
leader investigó y resolvió la infraestructura necesaria antes de
despachar trabajo de negocio: (1) un proxy en `vite.config.ts`
(`/api`,`/auth`,`/__test__` → servidor de contrato) para evitar el
problema de CORS al probar una sesión real en un navegador contra dos
procesos distintos; (2) `playwright.config.ts` con `webServer` como array
(contract-server en puerto fijo 4310 + `vite preview` con
`VITE_GATEWAY_BASE_URL=http://localhost:4173` inyectada solo en la config
de test); (3) un bug latente en `init.sh` corregido (`build` corría
después de `test:e2e`, sirviendo un `dist/` potencialmente
desactualizado); (4) `.env.example` nuevo. El implementer aplicó un fix
mínimo de 2 líneas en `e2e/contract-server/` (imports de valor sin
extensión `.ts`, necesarios para que Node lo arranque como proceso
standalone sin bundler), integró `SessionProvider`/`ProtectedRoute` en
`App.tsx` manteniendo `<h1>front</h1>` persistente fuera de la ruta
protegida (preserva el criterio de `scaffolding`), y ajustó
`e2e/scaffolding.spec.ts`/`tests/App.test.tsx` (features 1 y 3, ya
`done`) de forma mínima y justificada (sesión sintética antes de navegar,
para evitar una redirección real no determinista hacia Google en un
smoke test).

Feature de negocio: `src/features/scan/validateScanTarget.ts` (validador
puro de IPv4/CIDR con mensajes específicos por tipo de fallo, nunca un
genérico "inválido") y `ScanForm.tsx` (envío deshabilitado con entrada
inválida o petición en curso, usa `submitScan` de `src/api` sin
reimplementarlo, muestra `scanId` de inmediato o un error explícito por
tipo). `src/api` no fue tocado. 55/55 tests unitarios y 6/6 specs e2e
verdes (incluyendo los tres specs de features previas, confirmados sin
romperse).

El reviewer prestó atención especial al alcance ampliado (cambios en
`e2e/contract-server/`, `e2e/scaffolding.spec.ts`, `tests/App.test.tsx`,
todos de features ya `done`) y confirmó con `git diff` que cada cambio es
mínimo, justificado y no relaja ningún criterio de aceptación original.

Detalle completo: `progress/impl_scan_request_form.md` y
`progress/review_scan_request_form.md` (veredicto: `approved`, sin
cambios requeridos).

Pendiente para la próxima sesión: elegir la siguiente feature `pending`
(id 5, `realtime_status`) siguiendo el protocolo de `AGENTS.md`.

## Sesión 2026-09-20 — Feature 5: realtime_status

- **Feature:** `5 - realtime_status` — Estado de escaneo en tiempo real.
- **Agente:** leader (orquestó `implementer` + `reviewer`, sin explorers:
  `src/api/scanEvents.ts` y el servidor de contrato ya cubrían todo lo
  necesario).
- **Resultado:** `done`.

Resumen: se añadió `useScanEvents(scanId)` en `src/features/scan`,
construido sobre `subscribeToScanEvents` (feature `api_client`, sin
reimplementarla), que traduce el vocabulario SSE
(`started`/`completed`/`failed`) al vocabulario de UI ya existente
(`PENDIENTE`/`EN_PROGRESO`/`COMPLETADO`/`FALLIDO`, tipo `ScanStatus`
reutilizado) y expone también el `ConnectionStatus` para que "reconectando"
sea siempre visible, nunca un silencio indistinguible de "sin cambios".
Se integró en `ScanForm` (feature `scan_request_form`, cuyo propio
comentario de cabecera ya anticipaba este trabajo), y el hook limpia su
suscripción al desmontar/cambiar de `scanId`. El servidor de contrato ya
traía convenciones hechas a medida para esta feature (`target` con "fail"
→ desenlace fallido; con "disconnect" → corte de conexión SSE simulado),
descubiertas por el leader antes de despachar, evitando construir
infraestructura nueva.

Única desviación de "nunca mockear `src/api`" en todo el proyecto hasta
ahora: `tests/features/scan/ScanForm.test.tsx` stubea puntualmente
`subscribeToScanEvents` porque el polyfill de `EventSource` de `undici`
(usado por los tests, feature `api_client`) es incompatible con el
entorno `jsdom` (excepción no controlable en cuanto la conexión SSE
recibe cualquier respuesta real) y no existe combinación del stack actual
que permita renderizar un componente real (requiere `document`) y ejercer
un `EventSource` real (crashea en `jsdom`) a la vez. El reviewer
**reprodujo el crash de forma independiente** (test descartable, luego
eliminado) antes de aceptar la justificación, y confirmó que la lógica
que el stub reemplaza está cubierta sin mocks en
`tests/features/scan/useScanEvents.test.ts` (entorno `node`, servidor de
contrato real) y en `e2e/realtime-status.spec.ts` (navegador real).

59/59 tests unitarios y 7/7 specs e2e verdes (incluyendo los 6 specs de
features previas, confirmados sin romperse). `src/api` no tocado, sin
dependencias nuevas.

Detalle completo: `progress/impl_realtime_status.md` y
`progress/review_realtime_status.md` (veredicto: `approved`, sin cambios
requeridos).

Pendiente para la próxima sesión: elegir la siguiente feature `pending`
(id 6, `scan_history`) siguiendo el protocolo de `AGENTS.md`. Cuando esa
feature exista, revisar si conviene retomar la parte de "reflejar el
cambio de estado en la fila del histórico" que `realtime_status` dejó
fuera de alcance explícitamente por no existir todavía.

## Sesión 2026-09-20 — Feature 6: scan_history

- **Feature:** `6 - scan_history` — Histórico de escaneos y cancelación.
- **Agente:** leader (orquestó `implementer` + `reviewer`, sin explorers:
  `getScanHistory`/`cancelScan` de `src/api` ya cubrían todo lo
  necesario).
- **Resultado:** `done`.

Resumen: se añadió `src/features/history` con una tabla de histórico
(objetivo/estado/fecha) y acción de cancelar, construida enteramente
sobre `getScanHistory()`/`cancelScan()` ya existentes (`src/api` sin
tocar). `ScanHistoryEntry.scanId` es opcional en el contrato — una
entrada sin `scanId` nunca muestra la acción de cancelar, sin importar su
estado, verificado con tests explícitos en dos capas. Diseño
contenedor/presentacional (`HistoryTable`/`HistoryTableView`) para poder
testear ese caso límite (inalcanzable contra el servidor de contrato
real, que siempre asigna `scanId`) con props fabricadas en un componente
puro, sin recurrir a un mock de `src/api`. Tras cancelar, la fila se
actualiza vía un refetch simple de la lista (sin recargar la página);
los errores de cancelar (409/404/etc.) se muestran explícitos con
mensajes propios (nunca el texto crudo del Gateway) y el botón queda
reintentable, nunca colgado en estado de carga. `HistoryTable` se montó
en `App.tsx` dentro del mismo `ProtectedRoute` que `ScanForm`, sin
introducir routing nuevo.

El e2e de cancelación encola el escaneo directo por API (no vía
`ScanForm`) para evitar una ventana de ~40ms del guion del servidor de
contrato que completaría el escaneo antes de poder cancelarlo en
`PENDIENTE` — el reviewer evaluó esta simplificación y confirmó que no
deja ningún flujo de usuario relevante sin probar (el envío vía
formulario ya está cubierto en otros specs). 76/76 tests unitarios y 9/9
specs e2e verdes.

Detalle completo: `progress/impl_scan_history.md` y
`progress/review_scan_history.md` (veredicto: `approved`, sin cambios
requeridos).

Pendiente para la próxima sesión: elegir la siguiente feature `pending`
(id 7, `report_view`) siguiendo el protocolo de `AGENTS.md`. Recordar que
`getReport(scanId)` (feature `api_client`) apunta a un endpoint
especulativo/no confirmado en el Gateway real — ver
`progress/explore_gateway_contract.md` y `src/api/report.ts`.

## Sesión 2026-09-20 — Feature 7: report_view

- **Feature:** `7 - report_view` — Visualización y exportación del
  reporte.
- **Agente:** leader (orquestó `implementer` + `reviewer`, sin
  explorers).
- **Resultado:** `done`.

Resumen: se añadió `src/features/report` (`ReportView`/`ReportDetails`)
que obtiene el reporte vía `getReport(scanId)` (endpoint especulativo ya
aprobado, feature `api_client`) y lo muestra estructurado (host, tabla de
puertos, lista de vulnerabilidades) — nunca como JSON crudo en pantalla;
el JSON solo aparece como contenido del archivo exportado
(`buildReportExport.ts` + `downloadTextFile.ts`, `Blob`/`URL.createObjectURL`
nativos, sin dependencias nuevas). `ApiError.kind === "not_ready"` (409,
escaneo aún no completado) se traduce a un estado explicativo, distinto
del error genérico. Texto libre del backend (descripciones de
vulnerabilidades) se renderiza como texto JSX normal, nunca
`dangerouslySetInnerHTML` — verificado con un test que inyecta
`<script>...</script>` literal y confirma que se muestra como texto, no
como HTML real.

No existía forma de seleccionar "ver el reporte de este escaneo": se
añadió una acción "Ver reporte" en `HistoryTableView`
(`isReportViewableEntry`: solo `COMPLETADO` con `scanId` presente) que
sube el `scanId` seleccionado hasta `App.tsx` (estado levantado, mismo
patrón que `onCancel`), sin introducir `react-router` ni ninguna
dependencia de routing — mismo principio de minimalismo ya aplicado en
las 3 features anteriores. `scan_history` (feature 6, ya `done`) sigue
verde tras el cambio de prop.

Hallazgo técnico reutilizable: para un test de componente que necesita
`render`/DOM real (a diferencia de los tests de hook en entorno `node`) Y
que el guion SSE del servidor de contrato avance hasta `COMPLETADO`, ni
`EventSource` (choca con `jsdom`) ni el entorno `node` (no tiene
`document`) sirven — la solución fue un `fetch` normal al mismo endpoint
`/api/scans/:id/events` drenado con `response.text()`, que mantiene la
conexión abierta sin construir ningún `EventSource`. El reviewer lo
verificó como servidor real (no un mock) y sin flakiness (5 ejecuciones
aisladas seguidas).

93/93 tests unitarios y 11/11 specs e2e verdes (confirmado 2 veces por el
reviewer para descartar flakiness). Sin dependencias nuevas.

**Seguimiento no bloqueante para la próxima sesión**: el segundo test de
`e2e/report-view.spec.ts`
(`un_escaneo_no_completado_muestra_un_estado_explicativo_en_el_reporte`)
tiene un nombre/comentario que prometen más de lo que verifica (dicen que
se navega a `ReportView` para probar su estado `not_ready`, pero en
realidad solo comprueba que el histórico no ofrece "Ver reporte" para una
fila no completada — una aserción válida, solo mal etiquetada). Corregir
el nombre/comentario cuando se retome trabajo en esa zona.

Detalle completo: `progress/impl_report_view.md` y
`progress/review_report_view.md` (veredicto: `approved`, sin cambios
bloqueantes).

Pendiente para la próxima sesión: elegir la siguiente feature `pending`
(id 8, `containerization`) siguiendo el protocolo de `AGENTS.md`.

## Sesión 2026-09-20 — Feature 8: containerization

- **Feature:** `8 - containerization` — Imagen de despliegue de los
  assets estáticos.
- **Agente:** leader, **sin** `implementer`/`reviewer`: esta feature no
  toca `src/`/`tests/`/`e2e/` en absoluto (solo `Dockerfile`,
  `.dockerignore`, `nginx.conf.template`, `docs/architecture.md`), lo que
  cae explícitamente bajo "Cuándo NO aplica este rol" de
  `.claude/agents/leader.md`/`CLAUDE.md` ("cambios fuera de `src/` y
  `tests/`/`e2e/` (docs, configuración, `progress/`) → puedes editar tú
  mismo").
- **Resultado:** `done`.

Resumen: `Dockerfile` multi-stage siguiendo el mismo patrón ya establecido
por los repos hermanos (`gateway`/`user-service`/`nmap-service`: imágenes
base fijadas por tag **y** digest `@sha256:...`). Stage `builder`
(`node:22-bookworm-slim`) corre `npm ci && npm run build` (incluye `tsc
--noEmit`); stage runtime (`nginx:1.27-alpine`) sirve únicamente `dist/` +
una configuración de nginx generada desde `nginx.conf.template`, sin
Node/`node_modules`/código fuente, como el usuario no-root `nginx` (uid
101) que ya trae la imagen base. `VITE_GATEWAY_BASE_URL` es un build-arg
obligatorio (el build falla explícitamente si falta) que Vite hornea en
el bundle JS y que **también** parametriza `connect-src` en la
Content-Security-Policy servida por nginx (`default-src 'none'` +
overrides mínimos para `script-src`/`style-src`/`img-src` `'self'` sin
`unsafe-inline`, y `connect-src` restringido exactamente al Gateway
configurado en build) — nunca se abre la puerta a un origen distinto.
`.dockerignore` excluye `node_modules/`, `dist/`, `.git/`, `.claude/`,
`progress/`, `docs/`, `tests/`, `e2e/`.

Verificación manual documentada (no hay tests automatizados para esta
feature, consistente con su propio criterio de aceptación): `docker
build --build-arg VITE_GATEWAY_BASE_URL=https://gateway.example.com -t
front:local .` completa sin error; `docker run` sirve la SPA
correctamente en el puerto 8080 (verificado con `curl`, `200 OK`, HTML y
bundle JS servidos); `docker exec ... whoami`/`id` confirman que el
proceso corre como `nginx` (uid 101), nunca root; se confirmó por
inspección (`command -v node`, búsqueda de `node_modules`, `/app`
inexistente) que la imagen final no contiene Node, `node_modules`, código
fuente ni el `/app` del builder. `./init.sh` sigue en verde tras los
cambios (no afectan a `npm run test`/`test:e2e`/`build`). Imagen de
prueba (`front:local`) eliminada tras la verificación, no se deja como
artefacto.

`docs/architecture.md` actualizado con la nota de despliegue exigida por
el criterio de aceptación (qué incluye/excluye cada stage, por qué el
build-arg es obligatorio, por qué la CSP es restrictiva).

Detalle completo de la verificación: este mismo resumen (no hay
`progress/impl_containerization.md`/`progress/review_containerization.md`
porque no se despachó ningún subagente).

**Con esta feature se completan las 8 features de `feature_list.json`.**
No queda ninguna feature `pending`.
