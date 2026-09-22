# Review — feature 6 (scan_history)

**Veredicto:** APPROVED

## Verificación independiente ejecutada

Todas en verde, en el orden pedido:

1. `npm run typecheck` → sin errores.
2. `npm run lint` → sin warnings.
3. `npm run format:check` → sin diferencias.
4. `npm run test` → 76/76 tests (18 archivos), incluidos los 12 nuevos de esta feature.
5. `npm run build` → build de producción sin errores.
6. `npm run test:e2e` → 9/9 specs, incluyendo los 2 nuevos de `e2e/scan-history.spec.ts`
   (`cancelar_un_escaneo_en_curso_refleja_el_nuevo_estado_sin_recargar_la_pagina`,
   `un_escaneo_completado_no_muestra_accion_de_cancelar_en_el_historico`).
7. `./init.sh` → `[OK] Entorno listo. Puedes empezar a trabajar.` (las 5 secciones en verde).
8. `git diff --stat -- src/api/ package.json` → vacío, confirmado.

## Puntos específicos evaluados

1. **`scanId` opcional / `isCancellableEntry`** — `src/features/history/isCancellableEntry.ts:17-21`:
   `Boolean(entry.scanId) && CANCELLABLE_STATUSES.has(entry.status)`. `scanId` ausente
   siempre devuelve `false` sin mirar `status`. Hay test explícito de este caso en
   ambas capas: `tests/features/history/isCancellableEntry.test.ts:37-44`
   (`no_es_cancelable_sin_scanId_sin_importar_el_estado`, cubre `PENDIENTE` y
   `EN_PROGRESO` explícitamente) y `tests/features/history/HistoryTableView.test.tsx:119-131`
   (`oculta_la_accion_de_cancelar_si_la_entrada_no_tiene_scanId_sin_importar_el_estado`,
   con una entrada fabricada `status: "PENDIENTE"` sin `scanId`). Correcto.

2. **Separación contenedor/presentacional** — de acuerdo con el razonamiento del
   implementer. Confirmado por lectura directa: `HistoryTableView.tsx:13` solo
   importa `type { ScanHistoryEntry }` de `../../api` (import de tipo, sin runtime,
   sin `fetch`/`EventSource`); no hay ningún `vi.mock` en `HistoryTableView.test.tsx`.
   `HistoryTable.tsx` (el contenedor real, que sí llama a `getScanHistory`/`cancelScan`)
   se prueba en `HistoryTable.test.tsx` contra el servidor de contrato real
   (`useContractServer()`, sin `vi.mock` en todo el archivo). Pasar una entrada
   fabricada sin `scanId` a `HistoryTableView` no es un mock de `src/api`: es un
   componente puro recibiendo props explícitas, exactamente el patrón que documenta
   `docs/conventions.md` para tests de componente. De acuerdo.

3. **"Sin recargar la página" tras cancelar** — `HistoryTable.tsx:93-115`
   (`handleCancel`): tras un `cancelScan` exitoso hace un refetch simple
   (`await getScanHistory()` seguido de `setState`), sin manipular el DOM ni
   `location.reload()`. El test `HistoryTable.test.tsx:62-80`
   (`cancelar_un_escaneo_en_curso_refleja_el_nuevo_estado_sin_recargar_la_pagina`)
   usa un único `render(<HistoryTable />)` y verifica el cambio de fila con
   `waitFor` sobre el mismo árbol montado — sin `unmount`/`render` nuevo de por
   medio. Correcto.

4. **Error al cancelar** — en el camino de error (`HistoryTable.tsx:106-114`) el
   `rowState` pasa a `{ status: "error", message }`, nunca se queda en
   `"cancelling"`. El botón solo se deshabilita cuando `rowState?.status ===
   "cancelling"` (`HistoryTableView.tsx:72`), así que tras un error queda habilitado
   y reintentable. Confirmado por test real contra el servidor de contrato
   (`HistoryTable.test.tsx:82-113`, fuerza un 409 real cancelando "por fuera" antes
   del clic) y por el test de props fabricadas
   (`HistoryTableView.test.tsx:167-189`, botón `toBeEnabled()` con `rowState.status
   === "error"`). Correcto.

5. **Mensajes de error sin texto crudo del Gateway** — `src/api/scans.ts:86` construye
   `{ kind: "conflict", message: result.bodyText }`, es decir el `ApiError` de tipo
   `conflict` sí trae el `bodyText` plano del servidor en su campo `message`. Se
   confirmó que `describeCancelError` (`HistoryTable.tsx:45-60`) **no usa
   `error.message`** en ningún branch: el caso `"conflict"` devuelve un string fijo
   propio ("El escaneo ya no se puede cancelar: probablemente ya terminó."), igual
   que `"not_found"`, `"network"`, `"unauthorized"`, `"unexpected"`. `bodyText` nunca
   llega a la UI. Coherente con `docs/conventions.md`.

6. **`e2e/scan-history.spec.ts`: encolar el escaneo a cancelar por API en vez de
   por el formulario** — simplificación razonable, no deja un flujo de usuario
   completo sin probar: la sumisión vía formulario real ya está cubierta end-to-end
   en `e2e/scan-request-form.spec.ts` y en el segundo spec de este mismo archivo
   (`un_escaneo_completado_no_muestra_accion_de_cancelar_en_el_historico`, que sí
   pasa por `ScanForm`/`useScanEvents` hasta `COMPLETADO`). Lo que se prueba aquí
   con el encolado directo por API es exactamente la cancelación (RF-14) desde la
   UI real del histórico, que es el objeto de esta feature; el motivo (ventana de
   ~40ms del guion del servidor de contrato antes de completarse, no determinista
   para alcanzar a cancelar en `PENDIENTE`) está documentado en la cabecera del
   archivo y es consistente con lo observado en `e2e/contract-server`. No se
   identifica una combinación de usuario relevante (encolar por formulario +
   cancelar) que quede sin ejercitar de forma significativa: es un detalle de
   implementación (qué dispara qué en el mismo tick), no un flujo de negocio distinto.
   Aceptable.

7. **`App.tsx`** — diff confirmado: `<HistoryTable />` se agregó dentro del mismo
   `<ProtectedRoute>` que ya envolvía `<ScanForm />` (`src/App.tsx`), sin tocar
   `main.tsx` ni introducir ninguna librería de routing nueva.

8. `git diff --stat -- src/api/ package.json` → sin salida, confirmado independientemente.

9. **Sin tokens/credenciales/`console.log`/`any`/`@ts-ignore`** — `grep` sobre
   `src/features/history`, `tests/features/history` y `e2e/scan-history.spec.ts`
   no encontró coincidencias de `console.`, `any`, `@ts-ignore`, `localStorage` ni
   `sessionStorage`. Tampoco en el resto de `src/`/`tests/`/`e2e/` (los únicos
   `console.*` del repo viven en `e2e/contract-server/`, infraestructura de test
   explícitamente permitida por `docs/conventions.md`).

## Checkpoints (`CHECKPOINTS.md`)

- **C1 — arnés completo**: [x] Existen los 4 archivos base y los 4 docs; `./init.sh`
  terminó con exit 0 (confirmado con `$?` implícito por el resumen `[OK]` final y
  ejecución repetida sin fallos).
- **C2 — estado coherente**: [x] Solo la feature 6 está `in_progress` en
  `feature_list.json` (1-5 `done`, 7-8 `pending`); las features `done` tienen tests
  que siguen pasando (76/76); `progress/current.md` describe la sesión activa de
  `scan_history`, sin basura de sesiones previas.
- **C3 — arquitectura respetada**: [x] `src/` solo contiene `api`, `auth`,
  `features`, `components`, `routes` (mas `App.tsx`/`main.tsx`/`vite-env.d.ts` en la
  raíz, ya presentes desde `scaffolding`); no hay dependencia nueva en
  `package.json` (diff vacío); sin `console.log` de depuración, `any`/`@ts-ignore`
  sin justificar en el código de esta feature; `typecheck`/`lint` sin
  errores/warnings.
- **C4 — verificación real**: [x] `tests/features/history/` cubre tanto la lógica
  pura (`isCancellableEntry`) como los dos componentes (`HistoryTableView` en
  aislamiento, `HistoryTable` contra el servidor de contrato real, sin
  `vi.mock`/`msw`); `e2e/scan-history.spec.ts` cubre el flujo de histórico +
  cancelación de punta a punta. `npm run test`/`npm run build` verdes. (Nota: el
  flujo "reporte" de C4 sigue sin e2e porque `report_view`, feature 7, todavía está
  `pending` — no es una carencia de esta feature.)
- **C5 — cierre de sesión**: [ ] No evaluado como bloqueante para este veredicto:
  `progress/history.md` todavía no tiene la entrada de esta sesión (`scan_history`)
  ni `feature_list.json` fue marcada `done` — eso corresponde al `leader`/`reviewer`
  al cerrar la sesión tras este approve, según el protocolo de `AGENTS.md`; no hay
  archivos sin trackear sospechosos (`git status` solo muestra los archivos nuevos
  esperados de esta feature).

## Conclusión

Los 9 puntos de la consigna se verifican correctos contra el código real (no solo
el informe del implementer): la exclusión de entradas sin `scanId` es robusta y
probada en ambas capas, la separación contenedor/presentacional es genuina (sin
imports de runtime de `src/api` en el componente presentacional), el refetch tras
cancelar no recarga la página, los errores de cancelar son reintentables y nunca
exponen `bodyText` crudo del Gateway, la simplificación del e2e es razonable y no
deja un flujo de usuario relevante sin cubrir, `App.tsx` no introdujo routing
nuevo, y `src/api`/`package.json` no se tocaron. Todas las verificaciones
(`typecheck`, `lint`, `format:check`, `test`, `build`, `test:e2e`, `init.sh`) están
en verde, ejecutadas de forma independiente por este reviewer.

Sin cambios requeridos.
