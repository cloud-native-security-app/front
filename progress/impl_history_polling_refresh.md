# Informe del implementer — feature 16 `history_polling_refresh`

## Resumen

`HistoryTable` (`src/features/history/HistoryTable.tsx`) ahora hace
polling periódico de `getScanHistory()` mientras haya al menos una entrada
en estado no terminal (`PENDIENTE`/`EN_PROGRESO`) en `state.entries`. Esto
cubre el caso en que el SSE del Gateway se corta o no llega a tiempo y un
escaneo ya terminado en el backend se seguía mostrando "en progreso"
indefinidamente en `front`.

## Cambios

- `src/features/history/HistoryTable.tsx`:
  - Nueva constante `HISTORY_POLL_INTERVAL_MS = 7000` (7s, dentro del
    rango 5-10s pedido).
  - `NON_TERMINAL_STATUSES` (`PENDIENTE`/`EN_PROGRESO`) + helper puro
    `hasNonTerminalEntries(entries)`.
  - Variable derivada `isPolling = state.status === "loaded" &&
    hasNonTerminalEntries(state.entries)`.
  - Nuevo `useEffect` con `[isPolling]` como dependencia: si `isPolling`
    es `false` no hace nada (no crea intervalo); si es `true`, crea un
    `setInterval` que llama a `getScanHistory()` y actualiza `state` igual
    que el efecto de carga inicial, con el mismo patrón de bandera
    `active` (evita `setState` tras desmontar) y `clearInterval` en el
    cleanup.
  - Por construcción de `useEffect`, cuando `isPolling` pasa de `true` a
    `false` (todas las entradas quedan terminales) el efecto se limpia y
    no vuelve a crear intervalo — el polling se detiene solo. Si luego
    reaparece una entrada no terminal (p. ej. el usuario encola un nuevo
    escaneo desde otra parte de la UI mientras la tabla sigue montada),
    `isPolling` vuelve a `true` y el efecto se re-ejecuta, reactivando el
    polling.
  - El refetch inmediato existente tras `cancelScan` exitoso
    (`handleCancel`) no se tocó — sigue siendo un mecanismo aparte,
    adicional al polling.
  - No se introdujo ningún `EventSource`/SSE nuevo.

## Tests nuevos

`tests/features/history/HistoryTablePolling.test.tsx` (mismo patrón que
`HistoryTable.test.tsx`: contra el servidor de contrato real, nunca
`vi.mock` de `src/api`):

1. `con_entradas_no_terminales_avanzar_el_tiempo_dispara_un_refetch_adicional`:
   crea un escaneo (queda `PENDIENTE`), monta `HistoryTable`, y cambia el
   estado real en el backend "por fuera" del componente llamando a
   `cancelScan` directamente desde el test (mismo truco que ya usa
   `HistoryTable.test.tsx::un_error_al_cancelar...` para simular una
   carrera) — esto simula un desenlace que llegó al backend sin que el SSE
   se lo notificara a esta pestaña. Luego avanza el tiempo con fake timers
   y verifica que la fila pasa a `FALLIDO` sin ninguna interacción de
   usuario.
2. `con_todas_las_entradas_terminales_avanzar_el_tiempo_no_dispara_ningun_refetch`:
   crea un escaneo y lo cancela antes de montar (entrada inicial ya
   terminal), monta `HistoryTable`, encola un segundo escaneo directamente
   contra el servidor de contrato (sin pasar por la UI) y avanza el tiempo.
   Verifica que esa segunda entrada **no** aparece — si el polling
   estuviera incorrectamente activo, el refetch la habría revelado.

### Nota técnica sobre los fake timers usados

Los tests usan `vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })`
en vez de `vi.useFakeTimers()` a secas. Motivo verificado empíricamente: el
polling solo usa `setInterval`/`clearInterval`, pero estos tests de
componente siguen haciendo peticiones HTTP reales contra el servidor de
contrato (`useContractServer`, ver `docs/verification.md` Nivel 1). El
cliente HTTP real de Node (`undici`, usado por `fetch`) depende
internamente de `setTimeout` para resolver sus promesas; fakear también
`setTimeout`/`Date` (el comportamiento por defecto de
`vi.useFakeTimers()`) cuelga la petición indefinidamente (confirmado con un
repro aislado: `getScanHistory()` nunca resuelve bajo fake timers por
defecto, pero sí resuelve normalmente acotando el `toFake` a
`setInterval`/`clearInterval`). Acotar el fake timer a los únicos timers
que usa el polling evita ese problema sin perder el control determinista
del intervalo que pide el criterio de aceptación.

También es necesario activar los fake timers **antes** de montar el
componente en el primer test: el `setInterval` del polling se crea dentro
de un efecto al montar, y un timer creado con el `setInterval` real (antes
de activar los fake timers) no queda bajo el reloj falso — `vi.advanceTimersByTime`
no lo adelanta.

## Verificación

- `npm run typecheck` — verde.
- `npm run lint` — verde, sin warnings.
- `npm run format:check` — verde.
- `npm test` (suite completa, 30 archivos / 133 tests) — verde.
- `npm run test tests/features/history/HistoryTablePolling.test.tsx`
  ejecutado 5 veces consecutivas — verde las 5 veces (sin intermitencia).
- `./init.sh` completo (format, lint, typecheck, unit tests, build,
  e2e con playwright) — verde de punta a punta.

## Scope

Solo se tocó `src/features/history/HistoryTable.tsx` y se agregó
`tests/features/history/HistoryTablePolling.test.tsx`. Ningún otro
componente/feature fue modificado (`git diff --stat` confirma esto, además
de `feature_list.json` con el status `in_progress` ya puesto por el leader
y `progress/current.md`).

La feature queda en `"status": "in_progress"` en `feature_list.json` — no
se marca `done`, queda a criterio del reviewer.
