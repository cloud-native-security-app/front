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
