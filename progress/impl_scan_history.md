# Informe de implementación — feature 6 (`scan_history`)

## Qué se implementó

Histórico de escaneos del usuario (RF-13) con acción de cancelar (RF-14),
construido enteramente sobre `getScanHistory()`/`cancelScan()` ya
existentes en `src/api/scans.ts` (feature `api_client`, `done`) — no se
tocó `src/api`.

Archivos nuevos:

- `src/features/history/isCancellableEntry.ts` — validador puro (sin IO,
  mismo espíritu que `validateScanTarget`): decide si una entrada del
  histórico debe mostrar la acción de cancelar. Una entrada sin `scanId`
  (campo opcional del wire format, `src/api/types.ts:23`) **nunca** es
  cancelable, sin importar su `status`.
- `src/features/history/HistoryTableView.tsx` — componente presentacional
  puro: recibe `entries`, `rowStates` (estado de cancelación por fila) y
  `onCancel` como props; no importa nada de `src/api` salvo tipos. Renderiza
  la tabla (objetivo/estado/fecha/acción) y usa `isCancellableEntry` para
  decidir si mostrar el botón "Cancelar" por fila.
- `src/features/history/HistoryTable.tsx` — contenedor: hace el fetch
  inicial vía `getScanHistory()` en un `useEffect` (mismo patrón que
  `SessionProvider`: `.then()` dentro del efecto + bandera `active`, nunca
  una función `async` como cuerpo directo del efecto — evita el error de
  `eslint-plugin-react-hooks` `react-hooks/set-state-in-effect`), maneja el
  cancelar por fila (`cancelScan`) y renderiza `HistoryTableView`.
- `src/features/history/index.ts` — barrel de la feature.
- `App.tsx` — se añadió `<HistoryTable />` dentro del mismo `ProtectedRoute`,
  junto a `<ScanForm />` (sin introducir `react-router` ni ninguna otra
  librería de routing, mismo principio que `auth_session`/
  `scan_request_form`).
- `src/features/index.ts` — comentario de cabecera actualizado (ya no dice
  "se crea en...", apunta a `./history`).

## Decisiones tomadas

1. **"Sin recargar la página" tras cancelar → refetch simple**, no
   integración de `useScanEvents` por fila. Motivo: evitaría abrir un
   `EventSource` por cada fila con un escaneo activo en la tabla (N
   suscripciones simultáneas sin límite claro), y un refetch inmediato
   tras la acción explícita del usuario (clic en "Cancelar") ya cumple el
   criterio de aceptación sin esa complejidad adicional. Documentado en el
   comentario de cabecera de `HistoryTable.tsx`.
2. **Separación contenedor/presentacional** (`HistoryTable` vs
   `HistoryTableView`) específicamente para poder testear la lógica de
   mostrar/ocultar la acción de cancelar — incluido el caso "entrada sin
   `scanId`" — sin mockear `src/api` y sin depender de red. El servidor de
   contrato real (`e2e/contract-server/store.ts`) **siempre** asigna
   `scanId` a un scan creado, así que ese caso no es alcanzable llamando a
   `getScanHistory()` de verdad; en cambio, `HistoryTableView` es un
   componente puro que recibe `entries: ScanHistoryEntry[]` como prop, así
   que se le puede pasar directamente un array fabricado con una entrada
   sin `scanId` — esto **no es un mock de `src/api`** (no se intercepta
   ninguna llamada), es exactamente el mismo patrón de "componente en
   aislamiento con props explícitas" que ya recomienda
   `docs/conventions.md`. El contenedor `HistoryTable` (el que sí llama a
   `getScanHistory`/`cancelScan`) se prueba aparte, contra el servidor de
   contrato real, sin mocks.
3. **Errores de cancelar nunca exponen el texto crudo del Gateway**
   (`error.message` del `ApiError` de tipo `conflict` trae el `bodyText`
   plano del servidor) — se tradujeron a mensajes propios en
   `describeCancelError`/`describeHistoryError` (mismo patrón que
   `describeSubmitError` de `ScanForm.tsx`), por consistencia con
   `docs/conventions.md` ("los mensajes de error mostrados al usuario
   nunca incluyen detalles internos del Gateway").
4. **E2E**: el escaneo que se cancela en el spec e2e se encola directo por
   API (`context.request.post("/api/scans", ...)`), no a través del
   formulario de la UI. Motivo documentado en la cabecera de
   `e2e/scan-history.spec.ts`: si se encolara vía `ScanForm`,
   `useScanEvents` abriría de inmediato una suscripción SSE para ese
   `scanId`, y el guion del servidor de contrato completa el escaneo en
   ~40ms (`SCAN_EVENT_INTERVAL_MS=20ms` × 2 eventos) — una ventana
   demasiado angosta y no determinista para alcanzar a cancelarlo en
   `PENDIENTE`. Al encolarlo directo por API, nadie abre esa suscripción
   SSE, así que el scan se queda en `PENDIENTE` de forma estable hasta que
   el test lo cancela desde la UI real.

## Tests añadidos

- `tests/features/history/isCancellableEntry.test.ts` — validador puro:
  `PENDIENTE`/`EN_PROGRESO` con `scanId` → cancelable;
  `COMPLETADO`/`FALLIDO` → no cancelable; sin `scanId` → nunca cancelable
  (ambos estados activos probados explícitamente).
- `tests/features/history/HistoryTableView.test.tsx` — componente
  presentacional puro (props fabricadas, sin red): muestra
  objetivo/estado/fecha de cada entrada; muestra la acción de cancelar
  solo para `PENDIENTE`/`EN_PROGRESO` con `scanId`; la oculta para
  `COMPLETADO`/`FALLIDO`; la oculta para una entrada sin `scanId` aunque
  su `status` sea `PENDIENTE` (el caso explícito del criterio 2); dispara
  `onCancel` con el `scanId` correcto al hacer clic; deshabilita el botón
  mientras `rowState.status === "cancelling"`; muestra el error de
  cancelar sin quitar la fila; estado vacío explícito sin entradas.
- `tests/features/history/HistoryTable.test.tsx` — contenedor real, contra
  el servidor de contrato real (`getScanHistory`/`submitScan`/
  `cancelScan`, nunca `vi.mock`): lista el histórico con objetivo/estado/
  fecha; una entrada pendiente muestra el botón de cancelar; cancelar un
  escaneo en curso deja la fila en `FALLIDO` sin recargar la página
  (mismo `render`, sin `unmount`/nuevo `render`); un cancelar que llega
  tarde (el escaneo ya se canceló "por fuera" justo antes, forzando el
  409 real del servidor de contrato) muestra el error explícito
  (`role="alert"`) sin dejar el botón deshabilitado para siempre.
  No necesita el stub de `subscribeToScanEvents` que sí requiere
  `ScanForm.test.tsx`, porque `HistoryTable` nunca abre un `EventSource`
  (ver decisión 1).
- `e2e/scan-history.spec.ts` — dos specs contra `App.tsx` real integrado
  (sesión sintética real antes de navegar, mismo patrón que los specs e2e
  previos): (a) cancela un escaneo en curso y verifica que la fila pasa a
  `FALLIDO` sin recargar la página, y que el botón de cancelar desaparece
  después; (b) un escaneo llevado a `COMPLETADO` vía el flujo real de
  `ScanForm`/`useScanEvents` no muestra la acción de cancelar al
  recargar el histórico.

## Resultado de cada verificación

Ejecutadas en este orden, todas en verde:

1. `npm run typecheck` → OK, sin errores de tipos.
2. `npm run lint` → OK, sin warnings (se corrigió un error real de
   `react-hooks/set-state-in-effect` durante el desarrollo, ver decisión
   de diseño arriba).
3. `npm run format:check` → OK tras `prettier --write` sobre los archivos
   nuevos/modificados.
4. `npm run test` → **76/76 tests pasan** (18 archivos), incluidos los 12
   tests nuevos de esta feature.
5. `npm run build` → OK, build de producción sin errores.
6. `npm run test:e2e` → **9/9 specs pasan**: los 7 previos
   (`scaffolding`, `api-contract` ×2, `auth-session` ×2,
   `scan-request-form`, `realtime-status`) siguen verdes, más los 2 nuevos
   de `scan-history`.
7. `./init.sh` → `[OK] Entorno listo. Puedes empezar a trabajar.`
   (las 5 secciones del script en verde).

## Alcance respetado

- No se tocó `src/api` (ya exponía todo lo necesario).
- No se tocó `package.json`, `vite.config.ts`, `playwright.config.ts` ni
  `init.sh`.
- No se implementó reporte ni exportación (fuera de alcance, feature 7).
- No se introdujo `react-router` ni ninguna librería de routing nueva.
- No se manejó ni persistió ningún token/credencial — esta feature no
  toca login/sesión más allá de reutilizar `ProtectedRoute` ya existente.

## Estado

`feature_list.json` queda con la feature 6 en `"status": "in_progress"`
— no se marca `done` en esta sesión, según el protocolo (corresponde al
`reviewer`).
