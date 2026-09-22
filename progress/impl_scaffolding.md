# Informe de implementación — feature 1: scaffolding

**Agente:** implementer
**Fecha:** 2026-09-19
**Estado al cierre de esta sesión:** `in_progress` (queda pendiente de
revisión por el `reviewer`; el implementer no marca `done`).

## Qué se hizo

Scaffolding completo del proyecto React + TypeScript + Vite, sin lógica de
negocio de otras features (solo stubs documentados).

### package.json y toolchain

- `package.json` con scripts: `dev`, `build` (`tsc --noEmit && vite build`),
  `preview`, `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `format`
  (`prettier --write .`), `format:check` (`prettier --check .`), `test`
  (`vitest run`), `test:e2e` (`playwright test`).
- Dependencias runtime: `react`, `react-dom` (19.3.0).
- DevDependencies: `vite` 8.3.0, `@vitejs/plugin-react` 6.1.1, `typescript`
  6.0.3 (fijado por debajo de 6.1 porque `typescript-eslint`/`@typescript-
  eslint/*` 8.70.0 aún no soportan TS 7.x — verificado con `npm view
  peerDependencies` antes de fijar versiones), `eslint` 9.39.5 (en vez de la
  última 10.x, porque `eslint-plugin-react` 7.37.5 todavía no declara
  soporte para ESLint 10 en su rango de peerDependencies — instalar con
  ESLint 10 habría producido un conflicto de peer deps), `@eslint/js`
  9.39.5, `eslint-plugin-react`, `eslint-plugin-react-hooks`,
  `eslint-plugin-react-refresh`, `typescript-eslint`, `globals`,
  `eslint-config-prettier`, `prettier` 3.9.8, `vitest` 5.0.1, `jsdom`,
  `@testing-library/react` + `jest-dom` + `user-event`, `@types/react`,
  `@types/react-dom`, `@types/node` (necesario para tipar `process` en los
  archivos de configuración de Node como `playwright.config.ts`),
  `@playwright/test` 1.63.0.
- Cada dependencia nueva está justificada por esta feature (toolchain de
  build/test/lint) o por `docs/architecture.md` (React+TS+Vite, TanStack
  Query queda para `api_client` si aplica — no se introdujo aquí porque
  scaffolding no la necesita todavía).

### TypeScript

- `tsconfig.json` único (no solution-style) con `"strict": true`,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `jsx: react-jsx`,
  `types: ["vite/client", "node"]`. Incluye `src`, `tests`, `e2e` y los
  archivos de configuración (`vite.config.ts`, `vitest.config.ts`,
  `playwright.config.ts`, `eslint.config.js`) para que `tsc --noEmit` los
  cubra a todos.
  - Decisión: se descartó el patrón "solution-style" (`tsconfig.json` con
    solo `references`) porque con `tsc --noEmit` (sin `-b`) no dispara el
    chequeo de los proyectos referenciados — habría hecho que
    `npm run typecheck` "pasara" sin comprobar nada. Un único tsconfig es
    más simple y correcto para el tamaño actual del proyecto.

### Estructura de carpetas

- `src/api`, `src/auth`, `src/features`, `src/components`, `src/routes`:
  cada uno con un `index.ts` con un bloque JSDoc que documenta su
  responsabilidad futura (según `docs/architecture.md`) y qué feature de
  `feature_list.json` la implementará (`api_client` id 2, `auth_session`
  id 3, `scan_request_form`/`scan_history`/`report_view` ids 4/6/7). Cada
  stub exporta `{}` para ser un módulo válido sin introducir lógica.
- `src/App.tsx` / `src/main.tsx`: shell mínimo de la app (un `<h1>front</h1>`
  y un párrafo), documentando en JSDoc que aquí se montarán router/guard de
  auth/provider de fetching en features futuras. No se agregó React Router
  ni ninguna librería de fetching todavía — no hay feature que las necesite
  aún en el scope de `scaffolding` (ver `docs/security-scope.md`,
  "Dependencias": cada paquete nuevo se justifica por una feature).
- `tests/setup.ts` (matchers de `@testing-library/jest-dom`) y
  `tests/App.test.tsx` (test de componente real, con
  `screen.getByRole('heading', ...)`, no un "no crashea").
- `e2e/scaffolding.spec.ts`: smoke test de Playwright que navega a `/`
  contra el `preview` de Vite y comprueba el heading. No ejercita ningún
  flujo de negocio (login/escaneo/etc.) — eso llega con sus features.

### ESLint y Prettier

- `eslint.config.js` (flat config): `@eslint/js` recommended,
  `typescript-eslint` recommended, `eslint-plugin-react` (flat recommended +
  `jsx-runtime`), `eslint-plugin-react-hooks` recommended, y
  `eslint-plugin-react-refresh` (regla `only-export-components`).
  `eslint-config-prettier` al final para desactivar reglas de estilo que
  colisionarían con Prettier. Incluye `tests/**` y `e2e/**` en el lint (por
  convención, "incluye el código de tests/e2e, no solo src"), con globals
  de browser+node para esos archivos.
- `.prettierrc.json` explícito (semi, comillas dobles, trailing commas,
  printWidth 80) y `.prettierignore` que excluye artefactos de build
  (`dist`, `coverage`, etc.) y el harness del proyecto ajeno a esta SPA
  (`.claude/`, `AGENTS.md`, `CLAUDE.md`, `CHECKPOINTS.md`, `README.md`,
  `docs/`, `progress/`, `feature_list.json`) — no se reescribió contenido
  de esos archivos, solo se excluyeron del alcance de formato de código de
  `front`.

### Playwright

- `playwright.config.ts`: `testDir: "./e2e"`, `webServer` que levanta
  `npm run preview -- --port 4173 --strictPort` y espera esa URL,
  `baseURL` apuntando al mismo puerto. Documentado en el propio archivo que
  el servidor de contrato real llega con la feature `api_client`.
- Se instalaron los navegadores de Playwright con
  `npx playwright install chromium` (sin `--with-deps`, que requería `sudo`
  interactivo no disponible en este entorno — se evitó como posible
  workaround no autorizado; la instalación sin deps del sistema funcionó y
  el test e2e corrió sin problemas).

## Verificación ejecutada

Todos los comandos se corrieron desde la raíz del repo:

- `npm run typecheck` → OK, sin errores de tipos.
- `npm run lint` → OK, sin warnings/errores.
- `npm run format:check` → OK, sin diferencias de formato.
- `npm run test` (vitest) → 1 archivo, 1 test, verde
  (`renders_the_scaffolding_placeholder_heading`).
- `npm run test:e2e` (playwright, chromium instalado localmente) → 1 test,
  verde (`app_shell_mounts_and_renders_placeholder`).
- `npm run build` → `tsc --noEmit && vite build` compila sin errores ni
  warnings de TypeScript, genera `dist/`.
- `./init.sh` → todas las secciones en `[OK]`, resumen final: "Entorno
  listo. Puedes empezar a trabajar."

## Decisiones de versión relevantes (por si el reviewer las cuestiona)

- Se fijó `eslint@9.39.5` en vez de la última `10.x` disponible porque
  `eslint-plugin-react` (única opción vigente para el requisito "plugin de
  React" del criterio de aceptación 4) declara como rango de peer
  dependency `eslint: "^3 || ... || ^9.7"`, sin `^10`. Instalar con ESLint
  10 habría generado un conflicto `ERESOLVE` en `npm install`.
- Se fijó `typescript@6.0.3` (no la última `7.0.2`) por la misma razón con
  `@typescript-eslint/{parser,eslint-plugin}` (`typescript: ">=4.8.4
  <6.1.0"`).
- Ninguna de estas dos decisiones afecta el cumplimiento de los criterios
  de aceptación (TypeScript estricto sigue activo, ESLint sigue incluyendo
  los tres plugins requeridos); ambas quedan documentadas aquí para que una
  futura feature que quiera subir de versión sepa por qué se fijaron así.

## Cobertura de los criterios de aceptación

1. ✅ `package.json` con los 7 scripts pedidos.
2. ✅ `tsconfig.json` con `"strict": true`.
3. ✅ `src/{api,auth,features,components,routes}` con stub documentado cada
   uno; `tests/` y `e2e/` existen con contenido real (setup + 1 test cada
   uno).
4. ✅ ESLint con plugins React/hooks/TypeScript; `.prettierrc.json`
   explícito.
5. ✅ `playwright.config.ts` apunta a `npm run preview` (servidor local).
6. ✅ `npm run build` compila sin errores ni warnings de TypeScript.

## Fuera de alcance (a propósito)

- No se implementó ningún cliente HTTP/SSE real, hook de sesión, formulario
  de escaneo, router, ni librería de fetching — eso corresponde a las
  features 2-7 de `feature_list.json`. Los `index.ts` de cada carpeta son
  intencionalmente placeholders documentados.
- No se tocó `docs/security-scope.md` ni ninguna lógica de login/sesión,
  como corresponde a una feature de puro scaffolding.

## Siguiente paso

Lanzar al `reviewer` contra `docs/architecture.md`, `docs/conventions.md`,
`docs/verification.md` y `CHECKPOINTS.md`. El implementer **no** cambia el
estado de la feature a `done`.
