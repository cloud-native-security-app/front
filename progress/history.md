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

## Sesión 2026-09-24 — Feature 9: network_credentials_manager

- **Feature:** `9 - network_credentials_manager` — Gestión de credenciales
  de red (formulario + listado).
- **Agente:** leader → implementer (rol asumido directamente por el agente
  orquestador, ya que `subagent_type: "implementer"` no está disponible en
  este entorno) → `reviewer` (subagente independiente, mismo protocolo de
  `.claude/agents/reviewer.md`).
- **Resultado:** `done`.

Resumen: se añadió la feature 9, agregada al `feature_list.json` a partir de
un vacío de producto detectado en el repo hermano `gateway`
(`network_credentials_proxy`, `done`): sin una pantalla para crear
credenciales de red, ningún usuario podía completar login → configurar
credenciales → enviar escaneo (`POST /api/scans` siempre respondía `422`).
Se implementó `src/api/networkCredentials.ts` (tres funciones:
`createNetworkCredential`, `listNetworkCredentials`,
`deleteNetworkCredential`, mismo estilo que `scans.ts`), extendiendo
`httpClient.ts` para soportar el método `DELETE` (antes solo
`GET`/`POST`). El tipo `NetworkCredential` se verificó campo a campo contra
el contrato real ya cerrado en `gateway/src/usuarios_client.rs` (solo
lectura, otro repo): nunca incluye `ssh_credentials_ref`, mientras que
`CreateNetworkCredentialInput` (el cuerpo del `POST`) sí la incluye — esa
credencial SSH real nunca vuelve en ninguna respuesta del Gateway.

Feature de negocio: `src/features/credentials/` con `NetworkCredentialForm`
(formulario controlado, mismo patrón de estado que `ScanForm`;
`ssh_credentials_ref` como `type="password"`, se limpia tras éxito, nunca
se loggea), `NetworkCredentialsListView` (presentacional puro, mismo
criterio que `HistoryTableView`: nunca renderiza `ssh_credentials_ref`,
botón de borrar por fila) y `NetworkCredentialsManager` (contenedor: fetch
al montar + refetch simple tras crear/borrar, mismo patrón que
`HistoryTable`). Se montó en `App.tsx` dentro del mismo `ProtectedRoute`,
**antes** de `ScanForm` — sin introducir routing nuevo. Para
`target_pattern` (acepta IPv4 o IPv6 en el contrato real, pero
`validateScanTarget` solo reconoce IPv4) se decidió reutilizarlo como hint
de UX no bloqueante en vez de escribir un segundo validador, opción que el
propio `acceptance` de la feature permitía explícitamente. El servidor de
contrato local (`e2e/contract-server/`) se extendió con los 3 endpoints
nuevos, replicando el mismo criterio de ownership/404 (nunca `403`) que ya
usan scans.

El `reviewer` ejecutó una verificación independiente completa (`./init.sh`
en verde: 117/117 tests unitarios/componente, 12/12 specs e2e, build
limpio) y una revisión cruzada explícita contra
`gateway/src/api.rs`/`gateway/src/usuarios_client.rs` (solo lectura) para
confirmar el contrato campo a campo y código de estado a código de estado
(incluido que `DELETE` responde `404`, nunca `403`, para una entrada ajena
o inexistente). Verificó explícitamente ausencia de fuga de
`ssh_credentials_ref` en `localStorage`/`sessionStorage`, consola, y el
bundle de producción (`dist/assets/*.js`): la única aparición es el nombre
del campo en la construcción del cuerpo del `POST`, nunca un valor de
credencial real. Veredicto: `APPROVED`, sin cambios requeridos.

Detalle completo: `progress/impl_network_credentials_manager.md` y
`progress/review_network_credentials_manager.md`.

**Con esta feature se completan las 9 features de `feature_list.json`.**
No queda ninguna feature `pending`.

## Sesión 2026-09-24 — Feature 10: logout_button

- **Feature:** `10 - logout_button` — Botón de cerrar sesión.
- **Agente:** leader → implementer (rol asumido directamente por el agente
  orquestador, ya que `subagent_type: "implementer"` no está disponible en
  este entorno) → `reviewer` (subagente independiente, mismo protocolo de
  `.claude/agents/reviewer.md`).
- **Resultado:** `done`.

Resumen: el Gateway ya exponía `POST /auth/logout`
(`gateway/src/api.rs::logout`, feature `oidc_login`, `done`, solo lectura) —
deliberadamente fuera del middleware de sesión, así que invalida la cookie
`gateway_session` incluso sin sesión válida/presente y siempre responde
`204 No Content`. `front` no tenía ninguna forma de invocarlo: un usuario
logueado no podía cerrar sesión desde la UI.

Se agregó `logout(): Promise<ApiResult<void>>` en `src/api/auth.ts` (mismo
estilo que `getMe()`: mapea fallo de red a `network`, `status===204` a
éxito, cualquier otro status vía `mapCommonErrorStatus`), exportada desde
`src/api/index.ts`. `src/auth/LogoutButton.tsx` (nuevo) se autogatea con
`useSession().status === "authenticated"` (nunca visible en
`loading`/`anonymous`, sin depender de dónde se monte), usa una unión
discriminada `idle/submitting/error` (mismo patrón que
`ScanForm`/`NetworkCredentialForm`) para deshabilitar el botón mientras la
petición está en curso y mostrar un `role="alert"` en caso de fallo de red,
y en éxito navega con `window.location.href = "/"` — una recarga completa
de página, nunca `fetch` + estado de React puro, mismo principio ya
establecido en `LoginButton`/`ProtectedRoute`: tras la recarga
`SessionProvider` vuelve a llamar `getMe()` (que ahora responde `401`) y
`ProtectedRoute` redirige a login por su cuenta, sin lógica adicional en
`LogoutButton`. Se montó en `src/App.tsx` como primer hijo dentro de
`ProtectedRoute`. El servidor de contrato (`e2e/contract-server/server.ts`)
se extendió con `POST /auth/logout` replicando el mismo criterio del
Gateway real: fuera de `requireSessionToken`, borra la sesión del store si
el token era válido y siempre responde `204` limpiando la cookie.

Tests: `tests/api/auth.test.ts` (describe `logout`, contra el servidor de
contrato real: invalida la sesión y `getMe()` responde `unauthorized`
después; responde `ok` incluso sin sesión previa, igual que el Gateway
real). `tests/auth/LogoutButton.test.tsx` (nuevo, componente): no se
renderiza en `loading`/`anonymous`; con sesión, el clic llama a
`POST /auth/logout` (verificado con un spy de `fetch`) y navega a `/` en
éxito; se deshabilita mientras la petición está en curso (servidor
`node:http` con demora artificial de 50 ms); un fallo de red muestra el
error explícito sin navegar (servidor `node:http` cerrado tras `listen`,
mismo criterio que `tests/api/errorMapping.test.ts`) — nunca `vi.mock` de
`src/api`. `e2e/logout.spec.ts` (nuevo): flujo completo contra `App.tsx`
real (`webServer` de Playwright), sesión sintética real, clic real en el
botón, e intercepción de `**/auth/login` con `page.route` (mismo criterio
que el primer test de `e2e/auth-session.spec.ts`, ya que ni el Gateway real
ni el servidor de contrato pueden completar el handshake OIDC con Google
real en este entorno) para verificar que el navegador termina mostrando el
estado anónimo.

El `reviewer` ejecutó una verificación independiente completa (`./init.sh`
en verde: 124/124 tests unitarios/de componente, 13/13 specs e2e, build sin
errores), confirmó bullet a bullet cada criterio de `acceptance` contra el
código real, revisó `git status` para confirmar que solo se tocaron los
archivos declarados, y verificó explícitamente ausencia de
`localStorage`/`sessionStorage` y de cualquier manejo/inspección de la
cookie de sesión en todo el árbol tocado. Veredicto: `APPROVED`, sin
cambios requeridos.

Detalle completo: `progress/review_logout_button.md`.

**Con esta feature se completan las 10 features de `feature_list.json`.**
No queda ninguna feature `pending`.

## Sesión 2026-09-24 — Feature 11: basic_styling

- **Feature:** `11 - basic_styling` — Estilos visuales base de toda la app.
- `front` no tenía ningún CSS (0 archivos `.css`/`.scss`, sin librería de
  estilos en `package.json`): se renderizaba con el estilo por defecto del
  navegador. Feature puramente visual, sin cambiar comportamiento ni
  estructura semántica existente.
- Se creó `src/index.css` (CSS plano, sin CSS-in-JS ni estilos inline
  nuevos — la CSP de `front/nginx.conf.template`, `style-src 'self'` sin
  `unsafe-inline`, se sigue cumpliendo tal cual porque Vite extrae el
  archivo a un `<link rel="stylesheet">` en build) e importado una sola vez
  desde `src/main.tsx` (`import "./index.css";`). No se agregó ninguna
  dependencia nueva a `package.json`.
- Paleta sobria definida con custom properties en `:root`: fondo/superficie/
  texto neutros, un único color de acento para botones/acciones (todos los
  `<button>` de la app, coherentes entre sí), y colores reservados
  exclusivamente para `[role="alert"]` (rojo) y `[role="status"]` (verde) —
  reutilizando esa distinción semántica ya presente en el markup de
  `ScanForm`/`NetworkCredentialForm`/`NetworkCredentialsListView`/
  `HistoryTableView`/`ReportView`/`ReportDetails`/`ProtectedRoute`/
  `LogoutButton`, sin agregar ninguna clase nueva.
- Todo el estilo se aplicó con selectores de elemento/atributo (`form`,
  `table`, `th`/`td`, `button`, `input[type=...]`, `label`,
  `label:has(input[type="checkbox"])` para alinear el checkbox de
  `NetworkCredentialForm` en línea, `[role="alert"]`, `[role="status"]`,
  `:focus-visible`, `:disabled`) — **ningún componente de `src/features`,
  `src/auth` ni `src/App.tsx` fue tocado**: cero cambios de texto,
  atributos aria/role, estructura JSX o lógica. Tipografía con jerarquía
  (h1/h2/h3/label/p), espaciado consistente entre formularios/tablas/
  secciones, `form`/`table` como "tarjetas" visuales (mismo fondo/borde/
  radio, sin anidar doble borde cuando una `section` envuelve un
  formulario o tabla), estado `:disabled` visualmente distinto en inputs y
  botones, foco visible con `:focus-visible` sin eliminar el foco por
  defecto sin reemplazo, layout centrado (`#root` con `max-width: 960px`) y
  una media query de ventana angosta (`max-width: 640px`) que da scroll
  horizontal propio a las tablas en vez de desbordar la página.
- No se tocó `front/nginx.conf.template`: la CSP ya declarada
  (`style-src 'self'`, sin `unsafe-inline`) es compatible sin cambios.
- Ningún test unitario/de componente ni e2e necesitó ajustes (era el
  criterio explícito del `acceptance`): `./init.sh` en verde — prettier
  --check, eslint sin warnings, `tsc --noEmit` sin errores, 124/124 tests
  unitarios/de componente (vitest), `npm run build` sin errores, 13/13
  specs e2e (Playwright, Chromium real — incluye
  `e2e/network-credentials.spec.ts`, que ejercita el checkbox estilizado
  con `:has()`, confirmando empíricamente que el selector no rompe nada en
  Chromium).

El `reviewer` ejecutó una verificación independiente completa (`./init.sh`
en verde), confirmó bullet a bullet cada criterio de `acceptance` de la
feature 11 contra `src/index.css`/`src/main.tsx` reales, verificó por
`git diff`/comparación de `mtime` que ningún componente existente fue
modificado, confirmó ausencia de dependencias nuevas y de estilos inline/
CSS-in-JS en todo `src/`, y revisó la compatibilidad de la CSP en
`nginx.conf.template`. Veredicto: `APPROVED`, sin cambios requeridos.

Detalle completo: `progress/review_basic_styling.md`.

**Con esta feature se completan las 11 features de `feature_list.json`.**
No queda ninguna feature `pending`.

## Sesión 2026-09-28 — Feature 12: home_landing_page

- **Feature:** `12 - home_landing_page` — Página de inicio para el
  visitante anónimo.
- **Agente:** leader (diseño propio vía skill `frontend-design`,
  confirmado con el usuario) + `implementer` + `reviewer`.
- **Resultado:** `done`.

Resumen: el usuario pidió una página de inicio y trajo la skill
`frontend-design`. Investigación previa reveló que un visitante anónimo
hoy no ve nada — `ProtectedRoute` redirige de inmediato
(`window.location.href`) antes de renderizar cualquier contenido, y
`LoginButton` (construido en `auth_session`) nunca se monta en ningún
lado. Se trató esto como parte necesaria de la feature, no como scope
creep. Siguiendo el proceso de la skill (plan → revisión contra el brief
→ construir), el leader propuso 3 direcciones visuales distintas
(paleta/tipografía/wireframe ASCII cada una, ninguna calcada de los
clichés que la skill lista: crema+serif+terracota, negro+neón, eyebrows
en mayúsculas, tarjetas SaaS idénticas) vía `AskUserQuestion`; el usuario
eligió **"Signals & Traces"** (consola técnica oscura, acento cian único,
Space Grotesk + IBM Plex Mono, layout asimétrico alineado a la
izquierda, un solo momento de movimiento).

El leader cerró ese plan como criterios de aceptación concretos en
`feature_list.json` (copy literal incluido) antes de despachar, y aplicó
dos fixes de configuración propios (fuera de `src/`/`tests`/`e2e/`):
`font-src 'self'` en `nginx.conf.template` (las fuentes self-hosted lo
necesitaban) y `.agents/` en `.prettierignore` (el archivo de la skill no
es código de la SPA).

El implementer construyó `src/features/home/` con paleta/tipografía
propias (sin tocar `src/index.css` de `basic_styling`), copy literal, un
panel "Escaneo en vivo" decorativo que respeta `prefers-reduced-motion`,
y dos dependencias nuevas justificadas y pre-aprobadas
(`@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono`, self-hosted,
cero CDN de terceros). Para eliminar el auto-redirect silencioso,
`ProtectedRoute` ganó una prop obligatoria `anonymousView` (sin que
`src/auth` importe de `src/features/*`, respetando las capas) — cambio
que exigió ajustar deliberadamente tests de 4 features ya `done`
(`auth_session`, `scaffolding`, `scan_request_form`, `logout_button`),
cada uno documentado como consecuencia directa y necesaria, nunca
relajando lo que protegían.

El reviewer prestó atención especial a esos 4 ajustes (confirmó con
`git diff` que cada uno era mínimo y preservaba la propiedad original) y,
de forma más notable, **reprodujo la verificación de CSP contra la imagen
Docker real** (`docker build`+`docker run` de la feature
`containerization`, visitada con Chromium vía Playwright): confirmó
`font-src 'self'` en la respuesta real de nginx y cero violaciones de CSP
al cargar las fuentes self-hosted — la única forma de detectar de verdad
una CSP rota, ya que los tests contra el servidor de contrato no sirven
producción real. 128/128 tests unitarios y 14/14 specs e2e verdes.

Detalle completo: `progress/impl_home_landing_page.md` y
`progress/review_home_landing_page.md` (veredicto: `approved`, sin
cambios requeridos).

**Con esta feature se completan las 12 features de `feature_list.json`.**
No queda ninguna feature `pending`.

## Sesión 2026-09-28 — Feature 13: scan_console_redesign

- **Feature:** `13 - scan_console_redesign` — Rediseño visual del
  formulario de escaneo ("consola de escaneo").
- **Agente:** leader (diseño propio, extensión de "Signals & Traces") +
  `implementer` + `reviewer`.
- **Resultado:** `done`.

Resumen: el usuario pidió mejorar la UI de "la vista de escáner". El
leader aclaró alcance y dirección con dos preguntas (`AskUserQuestion`)
antes de escribir la feature: alcance = solo `ScanForm` (no toda la
consola autenticada), dirección = extender la identidad "Signals &
Traces" de `home_landing_page` (id 12) a este componente específico, en
vez de quedarse en la paleta clara de `basic_styling`. (Efecto colateral
detectado y corregido de paso: el `.env.local` creado en el turno
anterior para ayudar al usuario con `npm run dev` local rompía un test
unitario porque Vitest también lo carga — se eliminó antes de arrancar
esta feature.)

El implementer restyleó `ScanForm` como un panel oscuro tipo consola,
reutilizando literalmente los mismos valores hex de `home.css`
(`#0b1220`/`#131b2c`/`#232e45`/`#e7ecf3`/`#8996ac`/`#38bdf8`, scoped bajo
`.scan-console`, sin tocar `home.css`/`src/index.css`) y las mismas dos
fuentes ya instaladas (Space Grotesk, IBM Plex Mono — sin dependencia
nueva). Cero cambios de lógica: `validateScanTarget`, `useScanEvents`,
`submitScan`, `describeSubmitError` intactos, solo JSX/CSS. Los colores
de alert/status se recalcularon específicamente para el fondo oscuro
(nunca reutilizando los de `src/index.css`, calibrados para fondo claro),
con cálculos de contraste WCAG documentados (~11:1, nivel AAA). El acento
cian mantiene la misma disciplina que la home page: solo el botón, el
punto "en vivo", y el foco.

El reviewer recalculó el contraste WCAG de forma independiente
(coincidió con el implementer), confirmó por `mtime` que los demás
archivos sin commitear en el árbol pertenecían a la feature previa
(`home_landing_page`) y no a esta sesión, verificó que el build no
duplica archivos de fuente, y confirmó que el único ajuste a un test
existente (un regex sin un espacio final, por el cambio de estructura
del DOM) sigue verificando exactamente el mismo comportamiento. 128/128
tests unitarios y 14/14 specs e2e verdes, sin dependencias nuevas.

Detalle completo: `progress/impl_scan_console_redesign.md` y
`progress/review_scan_console_redesign.md` (veredicto: `approved`, sin
cambios requeridos).

**Con esta feature se completan las 13 features de `feature_list.json`.**
No queda ninguna feature `pending`.

---

## 2026-09-29 — Feature 14 `no_store_fetch_cache` (pendiente de revisión del usuario)

- Arreglos de entorno previos: `./init.sh` fallaba por CRLF (`core.autocrlf=true`
  sin `.gitattributes`) y por falta del Chromium de Playwright. Se añadió
  `.gitattributes` (`* text=auto eol=lf`, commit `1e4e33b`) y se instaló
  Chromium solo en esta máquina.
- Implementer: `cache: "no-store"` en `performRequest`
  (`src/api/httpClient.ts`), con un comentario sobre el `GET /api/me` con 200
  cacheado tras el logout. Test nuevo `tests/api/httpClient.test.ts`
  (GET/POST/DELETE con el servidor de contrato).
- Reviewer: `approved`, sin cambios requeridos.
- Verificación final del leader: typecheck, lint, format:check y `npm test`
  (131/131) en verde en la 1.ª ejecución.
- Sin commit: el usuario revisa el diff antes. La feature queda `in_progress`
  hasta entonces.
- Problema conocido registrado como feature 15 (`pending`): dos tests
  intermitentes por timeout en `NetworkCredentialForm.test.tsx`. Ya existían
  antes y no tienen relación con la feature 14.
- Informes: `progress/impl_no_store_fetch_cache.md`,
  `progress/review_no_store_fetch_cache.md`.

## Cierre — Feature 14: no_store_fetch_cache

El código ya estaba commiteado (rama `feature/no_store_fetch_cache`, el
cambio llegó a `main` vía la fusión de `feature/logout`). Quedaba pendiente
solo el estado en `feature_list.json` (`in_progress`). Verificado de nuevo
en esta sesión: `typecheck`, `lint`, `format:check` y `npm test` (131/131)
en verde. Estado → `done`.

## Sesión 2026-10-01 — Feature 15: stabilize_network_credential_form_tests

- **Feature:** `15 - stabilize_network_credential_form_tests`.
- **Agente:** leader + `implementer` + `reviewer`.
- **Resultado:** `done`.

Causa raíz: `userEvent.type` sin `delay: null` acumula tiempo letra por
letra y, con la suite en paralelo, supera el timeout de 5s de Vitest.
Fix: `userEvent.setup({ delay: null })` en los dos tests afectados de
`tests/features/credentials/NetworkCredentialForm.test.tsx` — mismo
comportamiento verificado, sin tocar `src/`. 5 corridas consecutivas de
`npm test` en verde (131/131 cada vez), `./init.sh` completo en verde.

Hallazgo registrado para el futuro (no corregido aquí, fuera de alcance):
el mismo patrón de timeout aparece en `tests/features/scan/ScanForm.test.tsx`
y `tests/features/home/HomePage.test.tsx` (otras features ya `done`).

Detalle: `progress/impl_stabilize_network_credential_form_tests.md`,
`progress/review_stabilize_network_credential_form_tests.md` (`approved`).
