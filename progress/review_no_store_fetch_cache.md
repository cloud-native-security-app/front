# Review: feature 14 `no_store_fetch_cache`

**Veredicto:** approved

## Alcance del diff
- `git status`: modificados `src/api/httpClient.ts`, `feature_list.json` y `progress/current.md`; sin trackear `tests/api/httpClient.test.ts` y `progress/impl_no_store_fetch_cache.md`. No aparece ningún otro archivo.
- `git diff --stat`: `src/api/httpClient.ts | 3 +++`. Solo son líneas añadidas.
- `src/api/httpClient.ts:40-42`: se añaden un comentario de 2 líneas ("un `GET /api/me` con 200 cacheado haría parecer activa la sesión después del logout") y `cache: "no-store"`. `credentials: "include"`, `headers`, `body`, el `catch` de `networkError`, `mapCommonErrorStatus` y `parseJson` no cambian. La firma de `performRequest` tampoco cambia.

## Test
- `tests/api/httpClient.test.ts`: `it.each` sobre GET/POST/DELETE. Usa `useContractServer()`, el servidor de contrato real, y `vi.spyOn(globalThis, "fetch")` sin `mockImplementation`, así que las llamadas llegan al servidor igual que en `tests/auth/LogoutButton.test.tsx`. No hay `vi.mock`/`msw` a nivel de módulo, lo que cumple `docs/verification.md` y `docs/security-scope.md`.
- Comprueba `toHaveBeenCalledWith(\`${gatewayBaseUrl()}/api/me\`, objectContaining({ method, cache: "no-store", credentials: "include" }))`. Si se quita `cache: "no-store"`, el test falla, así que verifica de verdad el requisito.

## Seguridad
- No se toca ningún token, `localStorage`/`sessionStorage` ni `console.*`. El cambio refuerza el cierre de sesión porque no se reutiliza una respuesta cacheada de `/api/me`.

## Ejecuciones (reviewer, 2026-09-29)
- `npm run typecheck`: OK (tsc, exit 0)
- `npm run lint`: OK (eslint, exit 0, sin warnings)
- `npm run format:check`: OK ("All matched files use Prettier code style!")
- `npm test`, ejecución 1: 29/29 archivos, 131/131 tests en verde. Los tests intermitentes de `NetworkCredentialForm.test.tsx` no fallaron y no hizo falta reejecutar.
- `./init.sh`: exit 0, e2e 14/14 en verde.

## Acceptance
- [x] `cache: "no-store"` en todas las llamadas, con un comentario breve sobre el GET /api/me cacheado tras el logout
- [x] No cambia nada más. El diff de código solo toca `src/api/httpClient.ts` y el test nuevo; `feature_list.json` y `progress/` los editó el leader
- [x] Test unitario en `tests/api/` que verifica `cache: "no-store"`
- [x] typecheck, lint, format:check y test en verde

## Checkpoints (aplicables a esta feature)
- C1: [x] el arnés está completo y `./init.sh` sale con 0
- C2: [x] hay una sola feature `in_progress` (la 14) y `current.md` describe la sesión activa
- C3: [x] no hay carpetas nuevas en `src/`, dependencias nuevas, `any`, `console.log` ni TODOs. typecheck y lint están limpios
- C4: [x] el test nuevo usa el servidor de contrato real y todos los tests están en verde
- C5: [ ] no se aplica todavía: la sesión no está cerrada (sin commit, la feature sigue en `in_progress` y aún no hay entrada en `history.md`). Corresponde al leader al cerrar, y no bloquea esta revisión.

## Cambios requeridos
Ninguno.
