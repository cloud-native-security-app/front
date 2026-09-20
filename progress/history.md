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
