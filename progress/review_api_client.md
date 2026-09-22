# Review — feature 2 (api_client)

**Veredicto:** APPROVED

## Verificación ejecutada de forma independiente

- `npm run typecheck` → sin errores.
- `npm run lint` → sin warnings.
- `npm run format:check` → sin diferencias.
- `npm run build` → compila sin errores (15 módulos, `tsc --noEmit && vite build`).
- `npm run test -- --run` → 8 archivos, **30/30 tests pasan**.
- `npm run test:e2e` → **3/3 tests pasan** (2 nuevos de `e2e/api-contract.spec.ts` +
  el smoke test de scaffolding).
- `./init.sh` → `[OK] Entorno listo.` (exit code 0).

## Revisión de código (línea por línea, no solo el informe)

1. **Las 7 funciones pedidas por `feature_list.json` id 2 existen y tipan sus
   errores.** `src/api/index.ts` reexporta `getMe`, `submitScan`,
   `getScanHistory`, `cancelScan`, `subscribeToScanEvents`, `getReport`,
   `loginRedirectUrl`. Ninguna función lanza un string suelto: todas
   retornan `ApiResult<T> = { ok: true; value } | { ok: false; error: ApiError }`
   (`src/api/types.ts:90-108`), lo que hace estructuralmente imposible
   "olvidar" un `.catch()` — cumple `docs/conventions.md` incluso más
   estricto que el ejemplo literal (que solo mostraba el tipo `ApiError`, sin
   prescribir throw vs. return). Decisión documentada explícitamente en
   `progress/impl_api_client.md` §"`ApiResult<T>` en vez de rechazar la
   promesa".
2. **URL base del Gateway nunca hardcodeada.** `src/api/config.ts:21-33`
   lee `import.meta.env.VITE_GATEWAY_BASE_URL` (tipada en
   `src/vite-env.d.ts`, sin `any`), con un solo escape hatch de test
   (`configureGatewayBaseUrl`) documentado como "nunca se llama desde código
   de producción real".
3. **Errores del Gateway como texto plano, nunca `await res.json()` en el
   camino de error.** `src/api/httpClient.ts:52` hace `response.text()`
   incondicionalmente; `parseJson()` (líneas 84-93) es la única función que
   intenta `JSON.parse`, y solo se llama en el camino de éxito de cada
   función (`auth.ts:43`, `scans.ts:34/57`, `report.ts:47`). Coincide con
   `progress/explore_gateway_contract.md` §5.
4. **`subscribeToScanEvents` usa `EventSource` nativo con
   `withCredentials: true`** (`src/api/scanEvents.ts:51`) y expone
   `ConnectionStatus = "connecting"|"open"|"reconnecting"|"closed"` vía
   callback, sin reimplementar el reconector — delega en el propio
   `EventSource`, solo interpreta `readyState` para distinguir
   reintentando/rendido (líneas 60-67). Se auto-cierra tras un evento
   terminal para no dejar al navegador reintentando contra un stream
   agotado (líneas 79-84), documentado con la referencia exacta al hallazgo
   del Gateway real (`el stream se cierra tras un evento terminal`).
5. **Servidor de contrato fiel y reutilizado, no duplicado.**
   `e2e/contract-server/server.ts` replica los endpoints/status
   codes/formato SSE de `progress/explore_gateway_contract.md` (401 texto
   plano genérico, 404 uniforme "ajeno == inexistente", 409 en cancelación
   terminal, `scanId` opcional en histórico no aplica aquí porque el
   servidor de contrato siempre lo rellena — aceptable, es una elección
   razonable del lado servidor de test). Documenta explícitamente (líneas
   1-24) las dos rutas que **no existen** en el Gateway real
   (`POST /__test__/session`, `GET /api/scans/:id/report`) para no
   confundirlas con contrato confirmado. El mismo `startContractServer` se
   usa desde Vitest (`tests/api/testHelpers.ts:22-34`, puerto efímero
   in-process) y desde Playwright (`e2e/api-contract.spec.ts:34-37`) — nunca
   se duplica un segundo servidor.
6. **`getReport` especulativo, correctamente marcado.** Documentado en tres
   lugares tal como pide la nota del leader: JSDoc de módulo en
   `src/api/report.ts:1-17` ("ADVERTENCIA — contrato especulativo, NO
   confirmado en el Gateway real"), comentario de módulo en
   `e2e/contract-server/server.ts:16-19`, y `progress/impl_api_client.md`
   §"Decisión sobre `getReport`". No se rechaza por esto, según lo acordado
   con el usuario.
7. **`package.json`/`package-lock.json`: cambio del leader verificado.**
   `git diff package.json` muestra únicamente la línea nueva
   `"undici": "8.10.2"` en `devDependencies`; `git diff package-lock.json`
   solo agrega la misma entrada al árbol de resolución de dependencias del
   proyecto raíz. La entrada `node_modules/undici` en el lockfile ya
   declaraba exactamente la versión `8.10.2` antes del cambio (dependencia
   transitiva preexistente) — no hay reescritura inesperada del árbol de
   dependencias.
8. **Tests unitarios cubren éxito + al menos un caso de error por función**,
   contra el servidor de contrato real o un servidor `node:http` ad-hoc
   (`tests/api/errorMapping.test.ts`, para red caída y payload inesperado,
   caso explícitamente permitido por el criterio de aceptación de la
   feature) — nunca `vi.mock`/interceptación de `fetch` a nivel de módulo.
   Revisados todos los archivos de `tests/api/`: `auth`, `scans`, `report`,
   `scanEvents`, `config`, `errorMapping`, `guards` (30 tests en total,
   confirmado contando `it(...)` y por la salida de `vitest`).
9. **Sin tokens/cookies de sesión en `src/`.**
   `grep -rn "localStorage\|sessionStorage\|document.cookie" src/` → sin
   resultados. `grep -rn "console\." src/` → sin resultados (ni siquiera
   `console.error`/`warn`). El cookie-jar de test
   (`e2e/contract-server/nodeTestSession.ts`) solo se importa desde
   `tests/setup.ts`, `tests/api/testHelpers.ts` y `e2e/api-contract.spec.ts`
   — nunca desde `src/` (confirmado con grep global).
10. **Sin `any` implícito ni `@ts-ignore` sin justificar en `src/`.**
    `grep -rn "@ts-ignore\|@ts-expect-error\|: any\|as any" src/` → sin
    resultados. Los dos únicos `@ts-expect-error` del repo están en
    `e2e/contract-server/nodeTestSession.ts:116,121`, cada uno con
    comentario explicando el motivo (polyfill de test, nunca en
    producción) — cumple `docs/conventions.md`.

## Observación menor (no bloqueante, seguimiento para features futuras)

- `ApiError` de `kind: "validation"`/`"conflict"` transporta el `bodyText`
  crudo del Gateway como `message` (`httpClient.ts:75`, `scans.ts:86`).
  Esto replica literalmente el shape de ejemplo de `docs/conventions.md`
  (`{ kind: "validation"; message: string }`), así que no es una
  desviación de esta feature. Pero `docs/conventions.md` también exige que
  "los mensajes de error mostrados al usuario nunca incluyen detalles
  internos del Gateway" — como todavía no existe ninguna UI que consuma
  `src/api` (eso llega con `scan_request_form`/`scan_history`), no hay
  filtración real hoy. Queda como recordatorio explícito para el
  `reviewer` de esas features futuras: no volcar `error.message` tal cual
  en pantalla sin decidir qué se muestra al usuario.

## Checkpoints (`CHECKPOINTS.md`)

- C1 — El arnés está completo: [x]
- C2 — El estado es coherente: [x] (`feature_list.json` tiene una sola
  feature `in_progress` — id 2, sigue así, no se marcó `done`; feature 1
  `done` tiene test asociado, `tests/App.test.tsx`; `progress/current.md`
  describe la sesión activa sin basura de sesiones anteriores)
- C3 — El código respeta la arquitectura: [x] (`src/` solo tiene
  `api/auth/features/components/routes`; única dependencia nueva,
  `undici`, justificada y ya presente transitivamente; sin
  `console.log`/`any`/`@ts-ignore` sin justificar en `src/`; `typecheck` y
  `lint` sin errores/warnings)
- C4 — La verificación es real: [ ] ← Razón: el bullet de `e2e/` exige "al
  menos un test end-to-end por flujo de usuario completo (login, nueva
  solicitud, tiempo real, histórico, cancelación, reporte)" — eso todavía
  no aplica porque esta feature (`api_client`, id 2) no incluye ninguna UI;
  los flujos de usuario llegan con las features 3-7, todas `pending`. No es
  un defecto de esta feature (que sí cumple su propio criterio de
  aceptación de `feature_list.json`, incluyendo su propio e2e contra el
  servidor de contrato), sino un checkpoint de estado final del proyecto
  completo que aún no corresponde marcar hasta que existan esas features.
  El resto del checkpoint sí se cumple: `tests/` tiene un test por función
  pública de `src/api`, `npm run test` muestra 30 tests verdes, `npm run
  build` genera sin errores.
- C5 — La sesión se cerró bien: [ ] ← Razón: no bloqueante para este
  veredicto — `progress/history.md` todavía no tiene entrada para esta
  sesión (se espera que el `leader` la añada al cerrar la sesión, después
  de este review); no hay archivos sospechosos sin trackear (`*.tmp`,
  `dist/`/`node_modules/` fuera de `.gitignore` — confirmado, ninguno).

## Cambios requeridos

Ninguno. La feature cumple los 5 criterios de aceptación de
`feature_list.json` id 2, respeta `docs/architecture.md` (capa `src/api`
como único punto de contacto con el Gateway), `docs/conventions.md` (estilo,
`ApiError` tipado, JSDoc en API pública) y `docs/security-scope.md` (sin
tokens/cookies en `src/`, `EventSource` con `withCredentials`, dependencia
nueva justificada). `./init.sh`, tests unitarios y e2e en verde de forma
independiente.
