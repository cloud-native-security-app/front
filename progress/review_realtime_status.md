# Review — feature 5 (realtime_status)

**Veredicto:** APPROVED

## Verificación independiente ejecutada

- `npm run typecheck` → OK, sin errores.
- `npm run lint` → OK, sin warnings.
- `npm run format:check` → OK, sin diferencias.
- `npm run test` (vitest) → 15 archivos, 59 tests, todos verdes.
- `npm run build` → OK, compila sin errores.
- `npm run test:e2e` (playwright, Chromium instalado en esta sesión) → 7
  specs, 7 tests, todos verdes: `scaffolding`, `api-contract` (x2),
  `auth-session` (x2), `scan-request-form`, `realtime-status`.
- `./init.sh` → `[OK] Entorno listo.` en las 5 secciones.

## Reproducción independiente del crash `jsdom`/`undici` (punto crítico)

Antes de aceptar la justificación del implementer sobre el stub de
`subscribeToScanEvents` en `tests/features/scan/ScanForm.test.tsx`, se
reprodujo el problema de forma independiente:

1. Se escribió un test descartable
   (`tests/features/scan/_repro_realtime.test.tsx`, eliminado después de la
   verificación, no queda en el repo — confirmado con `git status
   --porcelain` tras limpiar) que renderiza `ScanForm` real bajo `jsdom`
   (entorno por defecto de `vitest.config.ts`), con sesión sintética real
   (`loginAsSyntheticUser`) y `submitScan` real contra el servidor de
   contrato, **sin ningún mock de `src/api`** (ni siquiera
   `subscribeToScanEvents`). Al correrlo con
   `npx vitest run tests/features/scan/_repro_realtime.test.tsx`, el test
   "pasa" pero Vitest reporta una excepción no controlada idéntica a la que
   documenta el implementer:
   ```
   TypeError: The "event" argument must be an instance of Event. Received an instance of Event
    ❯ EventSource.dispatchEvent node:internal/event_target:784:13
    ❯ Object.fetchParams.processResponse node_modules/undici/lib/web/eventsource/eventsource.js:281:12
   ```
   Esto confirma empíricamente, de forma independiente, que la
   incompatibilidad `jsdom`/`undici` es real y no una conveniencia del
   implementer. El archivo descartable fue eliminado (`rm`) antes de
   cerrar esta revisión; `git status --porcelain` no muestra rastro de él.

2. Se confirmó que `tests/features/scan/useScanEvents.test.ts` corre bajo
   `// @vitest-environment node` y ejercita `subscribeToScanEvents` real
   (import directo desde `src/api`, sin `vi.mock`) contra el servidor de
   contrato real, cubriendo: secuencia completa
   `PENDIENTE→EN_PROGRESO→COMPLETADO` hasta `closed`, un target `...fail`
   (`PENDIENTE→EN_PROGRESO→FALLIDO`), y un target `...disconnect` donde
   `connectionStatuses` contiene `"reconnecting"` antes de llegar a
   `COMPLETADO`. Es una reimplementación deliberada y documentada de la
   reducción de estado del hook (no puede invocar el hook de React
   directamente porque `renderHook`/`render` de Testing Library requieren
   `document`, inexistente en entorno `node`) — usa la misma
   `scanOutcomeEventToStatus` exportada y la misma `subscribeToScanEvents`
   reales, así que la lógica de traducción de eventos queda cubierta sin
   mocks.

3. Se confirmó que `e2e/realtime-status.spec.ts` ejercita el flujo real
   (`ScanForm` + `useScanEvents` + `subscribeToScanEvents` reales, sin
   ningún mock) en Chromium real vía Playwright, llegando a
   `Estado: ... COMPLETADO` sin recargar la página.

4. Evaluación de cobertura perdida por el stub: el único escenario que el
   stub deja sin cubrir a nivel de componente jsdom es que la etiqueta
   "reconectando" se renderice en pantalla en respuesta a una transición
   real de `connectionStatus`. Sin embargo, esto **no es una pérdida
   causada por el stub**: `validateScanTarget` (feature `scan_request_form`,
   ya `done`) exige octetos IPv4 numéricos, así que ningún target con
   "disconnect" puede llegar a habilitarse en el formulario real — ni con
   ni sin el stub, un test de componente que use `ScanForm` a través de su
   UI jamás podría alcanzar ese escenario. La cobertura real está
   distribuida así, sin solapamiento perdido: (a) que `connectionStatus`
   efectivamente transiciona a `"reconnecting"` ante un corte de conexión
   real → `useScanEvents.test.ts` (sin mocks); (b) que la UI de `ScanForm`
   muestra esa etiqueta de forma visible y no condicionada a "open" →
   confirmado leyendo el JSX de `ScanForm.tsx` (líneas 99–104: el párrafo
   `role="status"` con `Estado: ... (${CONNECTION_STATUS_LABEL[...]})` se
   renderiza siempre que hay `scanId`, no solo cuando `connectionStatus ===
   "open"`, y `CONNECTION_STATUS_LABEL.reconnecting === "reconectando"`).
   Por tanto la desviación es aceptable: es un límite técnico genuino del
   stack actual, verificado de forma independiente, acotado a una sola
   función en un solo archivo, ampliamente documentado, y con cobertura
   equivalente distribuida en los otros dos niveles de test.

## Criterios de aceptación (feature_list.json, id 5)

1. `useScanEvents(scanId)` (`src/features/scan/useScanEvents.ts`) usa
   `subscribeToScanEvents` de `src/api` sin reimplementarla, y expone
   `{ status: ScanStatus, connectionStatus: ConnectionStatus }` — ambos
   tipos importados de `src/api` (`ScanStatus` de `src/api/types.ts` vía
   el barrel, `ConnectionStatus` de `src/api/scanEvents.ts`), sin tipo
   paralelo. **Cumple.**
2. `ScanForm.tsx` integra el hook tras un `submitScan` exitoso
   (`const scanEvents = useScanEvents(scanId)`, con `scanId` derivado de
   `submitState.status === "success"`) y muestra el estado en tiempo real
   sin recargar la página (confirmado en `e2e/realtime-status.spec.ts`,
   navegación única con `page.goto("/")`). La parte de "fila del
   histórico" queda fuera de alcance porque la feature `scan_history`
   (id 6) sigue `pending` — el propio criterio la condiciona con "si ya
   existe", así que no es un defecto de esta feature. **Cumple.**
3. Un corte de conexión SSE se refleja como "reconectando" visible: en
   `ScanForm.tsx` líneas 99–104, el párrafo de estado se renderiza siempre
   que hay `scanId` (no oculto cuando `connectionStatus !== "open""), y
   `CONNECTION_STATUS_LABEL.reconnecting === "reconectando"` (línea 20).
   No es un silencio indistinguible de "sin cambios". **Cumple.**
4. El hook cierra la suscripción en el cleanup del `useEffect`
   (`useScanEvents.ts` líneas 85–87: `return () => { subscription.close();
   }`), tanto al desmontar como al cambiar `scanId` (el efecto se
   re-ejecuta por el array de dependencias `[scanId]`, ejecutando el
   cleanup previo antes). Sin fugas de `EventSource`. **Cumple.**
5. Tests: unitario del hook con stream simulado — en rigor,
   `useScanEvents.test.ts` usa el servidor de contrato real (no un stream
   "simulado" en el sentido de mock, sino una simulación end-to-end vía
   SSE real), cubriendo secuencia completa y corte de conexión
   (`reconnecting` visible antes de completar) — cumple el espíritu del
   criterio con una aproximación más fuerte (sin mocks) que un simple
   stream simulado. E2e refleja la secuencia hasta estado terminal
   (`COMPLETADO`) sin recargar. **Cumple.**
6. Ajustes a `tests/features/scan/ScanForm.test.tsx` y
   `e2e/scan-request-form.spec.ts`: cambian `getByRole("status")`
   (ambiguo tras añadir un segundo `role="status"`) por `getByText(...)`
   del mismo texto específico que ya se verificaba
   (`/escaneo encolado\. id: /i`). Diffs mínimos, no relajan la
   aserción original (mismo contenido, mismo patrón regex). **Cumple.**
7. Sin tokens/cookies/credenciales, sin `any`/`@ts-ignore` sin justificar,
   sin `console.log` de depuración en el código de esta feature —
   confirmado con `grep` sobre los 7 archivos de la feature: sin
   coincidencias. **Cumple.**
8. `git diff --stat -- src/api/ package.json` vacío — confirmado, sin
   salida. No se tocó `src/api` ni se añadió ninguna dependencia nueva.
   **Cumple.**

## Checkpoints (CHECKPOINTS.md)

- C1: [x] — `AGENTS.md`, `init.sh`, `feature_list.json`, `progress/current.md`
  y los 4 docs existen; `./init.sh` termina exit code 0.
- C2: [x] — Solo la feature 5 está `in_progress`; toda feature `done` tiene
  tests asociados que pasan (59 tests verdes); `progress/current.md`
  describe la sesión activa sin basura de sesiones previas.
- C3: [x] — `src/` solo contiene `api`, `auth`, `features`, `components`,
  `routes`; no hay dependencia nueva en `package.json`; sin
  `console.log`/`any`/`@ts-ignore` sin justificar en el código de esta
  feature; `npm run typecheck` y `npm run lint` sin errores/warnings.
- C4: [x] — `tests/` cubre lógica pura y componentes; `e2e/` cubre el
  flujo de tiempo real contra el servidor de contrato real (sin
  `vi.mock`/`msw` sobre `fetch`/`EventSource` en los specs de
  `e2e/`); `npm run test` > 0 y todo verde; `npm run build` sin errores.
- C5: [x] — Sin archivos sin trackear sospechosos (`git status
  --porcelain` limpio tras eliminar el descartable de reproducción);
  `progress/current.md` refleja la sesión activa correctamente (la
  actualización de `progress/history.md` y el cierre final de sesión son
  responsabilidad del `leader`, no de este review puntual de la
  feature).

## Nota sobre la única desviación de "nunca mockear `src/api`"

Aceptada tras reproducción independiente (ver sección arriba). Es la
única excepción de todo el proyecto hasta ahora, está acotada a una sola
función (`subscribeToScanEvents`) en un solo archivo
(`tests/features/scan/ScanForm.test.tsx`), ampliamente documentada en el
encabezado del archivo, y su ausencia de cobertura no deja ningún hueco
real: la lógica que reemplaza (secuencia de estados, corte de conexión)
está cubierta sin mocks en `tests/features/scan/useScanEvents.test.ts` y
`e2e/realtime-status.spec.ts`, y el renderizado visible de "reconectando"
se confirma por lectura directa del JSX de `ScanForm.tsx`.
