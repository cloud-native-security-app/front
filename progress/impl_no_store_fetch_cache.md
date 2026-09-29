# Implementer — feature 14 `no_store_fetch_cache`

Estado: implementada y verificada. La feature sigue en `in_progress` y no hay commit, como se pidió.

## Cambios

- `src/api/httpClient.ts` (+3 líneas): en `performRequest`, dentro de las opciones de
  `fetch`, se añadió `cache: "no-store"` justo después de `credentials: "include"`, con este comentario:
  `// Sin caché HTTP del navegador: un \`GET /api/me\` con 200 cacheado`
  `// haría parecer activa la sesión después del logout.`
  No se tocó nada más: `credentials`, `headers`, `body`, `networkError`, `mapCommonErrorStatus` y `parseJson` siguen igual.
- `tests/api/httpClient.test.ts` (nuevo): no había ningún test de httpClient ni ninguno que comprobara
  las opciones de `fetch` en `tests/api/`, así que creé este archivo. Usa `useContractServer()` de
  `testHelpers.ts` (servidor real, sin mock de módulo) y `vi.spyOn(globalThis, "fetch")`, igual que
  `tests/auth/LogoutButton.test.tsx`. Es un `it.each` para GET/POST/DELETE que comprueba que `fetch`
  recibe `${gatewayBaseUrl()}/api/me` y
  `objectContaining({ method, cache: "no-store", credentials: "include" })`. Son 3 tests.

`git status` muestra, además de lo anterior, `feature_list.json` y `progress/current.md`, que el leader ya
había modificado antes de esta sesión. No los toqué, salvo por una línea en la bitácora de `current.md`.

## Verificación

- `npx vitest run tests/api/httpClient.test.ts`: 3/3 pasan.
- `npm run typecheck`: OK (código de salida 0).
- `npm run lint`: OK, sin errores ni advertencias.
- `npm run format:check`: OK ("All matched files use Prettier code style!").
- `npm test`: **1 ejecución**, 29/29 archivos y 131/131 tests pasan. Los tests intermitentes de
  `NetworkCredentialForm.test.tsx` no fallaron, así que no hubo que reejecutar.

## Pendiente

- Revisión del reviewer y del diff por parte del usuario. Después, commit y marcar `done`.
