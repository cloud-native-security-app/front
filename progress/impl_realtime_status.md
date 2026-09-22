# Implementación — feature 5 (`realtime_status`)

## Qué se implementó

- **`src/features/scan/useScanEvents.ts`** (nuevo): hook `useScanEvents(scanId)`
  que envuelve `subscribeToScanEvents` de `src/api` (feature `api_client`, sin
  reimplementarla) y expone `{ status, connectionStatus }`:
  - `status`: `ScanStatus` (`PENDIENTE|EN_PROGRESO|COMPLETADO|FALLIDO`,
    reutilizado de `src/api/types.ts`, sin tipo paralelo). Traducción vía
    `scanOutcomeEventToStatus` (exportada, pura): `started→EN_PROGRESO`,
    `completed→COMPLETADO`, `failed→FALLIDO` — mismo mapeo que
    `applyEventToRecord` en `e2e/contract-server/store.ts`. Antes de
    cualquier evento: `PENDIENTE`.
  - `connectionStatus`: el `ConnectionStatus` de `subscribeToScanEvents`
    (`connecting|open|reconnecting|closed`), para que la UI distinga
    "reconectando" de "sin cambios".
  - Cierra la suscripción (`subscription.close()`) en el cleanup del
    `useEffect` y al cambiar `scanId`. El reinicio de estado al cambiar
    `scanId` se hace **durante el render** (patrón oficial de React,
    "storing information from previous renders"), no dentro del efecto,
    porque `eslint-plugin-react-hooks` (`react-hooks/set-state-in-effect`)
    rechaza un `setState` incondicional al inicio del cuerpo de un efecto.
  - Si `scanId` es `undefined`, no se suscribe a nada.
- **`src/features/scan/ScanForm.tsx`** (modificado, tal como su propio
  comentario de cabecera anticipaba): al tener un `scanId` (tras un
  `submitScan` exitoso), llama a `useScanEvents(scanId)` y renderiza
  `<p role="status">Estado: {status} ({connectionStatus legible})</p>`,
  siempre visible (no oculto en "open"), así "reconectando" nunca es
  indistinguible de silencio.
- **`src/features/scan/index.ts`**: exporta `useScanEvents`,
  `scanOutcomeEventToStatus` y el tipo `ScanEventsState`.
- **Tests nuevos**:
  - `tests/features/scan/useScanEvents.test.ts` (entorno `node`, servidor de
    contrato real, sin mocks de `EventSource`/`subscribeToScanEvents`):
    - `scanOutcomeEventToStatus` (mapeo puro, 3 casos).
    - Secuencia completa `PENDIENTE→EN_PROGRESO→COMPLETADO` hasta `closed`.
    - Target `...fail` → `PENDIENTE→EN_PROGRESO→FALLIDO`.
    - Target `...disconnect` → `reconnecting` visible en
      `connectionStatuses` antes de llegar a `COMPLETADO`.
  - `e2e/realtime-status.spec.ts`: flujo completo en navegador real (Chromium
    vía Playwright) — sesión sintética, ingresar IP válida, ver
    `Estado: ... COMPLETADO` sin recargar la página.
- **Tests existentes ajustados** (efecto directo, documentado, de integrar
  un segundo elemento `role="status"` en `ScanForm`):
  - `tests/features/scan/ScanForm.test.tsx`: la aserción `getByRole("status")`
    ahora es ambigua (dos `role="status"`) → se cambió a `getByText(...)`
    del texto específico del `scanId`. Además se añadió un stub de
    `subscribeToScanEvents` (ver "Decisión/bloqueo evaluado" abajo).
  - `e2e/scan-request-form.spec.ts`: mismo ajuste (`getByText` en vez de
    `getByRole("status")`).

## Decisión importante evaluada y documentada: por qué `ScanForm.test.tsx` estabiliza `subscribeToScanEvents`

Al integrar `useScanEvents` en `ScanForm`, los 3 tests **preexistentes** de
`tests/features/scan/ScanForm.test.tsx` (jsdom, entorno por defecto)
empezaron a fallar con una excepción no controlable desde userland:

```
TypeError: The "event" argument must be an instance of Event. Received an instance of Event
  at EventSource.dispatchEvent node:internal/event_target
  at Object.fetchParams.processResponse node_modules/undici/lib/web/eventsource/eventsource.js
```

Confirmé empíricamente (con pruebas descartables, ya eliminadas) que:

1. Bajo el entorno `jsdom` de Vitest, el polyfill de `EventSource` de
   `undici` (instalado por `e2e/contract-server/nodeTestSession.ts`, feature
   `api_client`, ya `done`) **siempre** lanza esta excepción no controlable
   en cuanto la conexión recibe cualquier respuesta real del servidor de
   contrato (abrir la conexión basta; no hace falta ni un evento SSE real).
   Causa: `jsdom` reemplaza el `Event` global después de que Node ya fijó su
   propio `Event` nativo dentro del `dispatchEvent` interno; esa referencia
   nativa **no queda accesible desde ningún código de test** una vez
   sobrescrita (confirmado: no se expone vía ningún módulo importable de
   Node, ej. `node:events` no exporta `Event`).
2. `@testing-library/react`'s `render()` **requiere `document`** — falla con
   `ReferenceError: document is not defined` bajo el entorno `node` de
   Vitest. Es decir: no existe ninguna combinación de este stack de testing
   (sin instalar un paquete nuevo) que permita renderizar un componente real
   Y ejercer un `EventSource` real en el mismo test.
3. Por eso `tests/api/scanEvents.test.ts` (feature `api_client`) ya corría
   en entorno `node` — mismo motivo, documentado en su propio encabezado.

Dado que:
- No podía editar `package.json`/`vite.config.ts`/`playwright.config.ts`/
  `init.sh` (instrucción explícita de esta sesión).
- No debía tocar infraestructura compartida de otra feature ya `done`
  (`e2e/contract-server/nodeTestSession.ts`, `tests/setup.ts`,
  `vitest.config.ts`).
- No podía dejar tests previamente verdes en rojo.

la única vía dentro de mi alcance (el propio archivo de test de `ScanForm`,
que sí debía tocar por la integración) fue sustituir **únicamente**
`subscribeToScanEvents` por un stub inerte (`vi.mock` parcial de `src/api`,
manteniendo `getMe`/`submitScan` reales) en `ScanForm.test.tsx`. Lo documenté
extensamente en el encabezado de ese archivo, dejando explícito que es una
excepción puntual y por qué: el comportamiento real de
`subscribeToScanEvents`/`useScanEvents` (secuencia de estados, corte de
conexión, reconexión) se verifica **sin mocks**, contra el servidor de
contrato real, en `tests/features/scan/useScanEvents.test.ts` (entorno
`node`) y en `e2e/realtime-status.spec.ts` (navegador real, sin este
problema de `jsdom`).

Esto se lo señalo explícitamente al `reviewer`: es la única desviación de la
convención "nunca mockear `src/api`" en toda la sesión, acotada a un solo
archivo y a una sola función, con justificación técnica verificada
empíricamente (no una suposición) y con cobertura real equivalente en otros
dos archivos de test.

## Otras decisiones

- El criterio de aceptación menciona reflejar el cambio "en la fila del
  histórico (feature `scan_history`, si ya existe)" — esa feature (id 6)
  sigue `pending`, así que esa parte queda fuera de alcance, tal como el
  propio criterio lo condiciona.
- El e2e no ejercita los targets `...fail`/`...disconnect` del servidor de
  contrato: `validateScanTarget` (feature `scan_request_form`) exige
  octetos IPv4 numéricos, así que esos targets nunca llegan a habilitar el
  botón "Escanear" en la UI real. Esos dos escenarios se cubren sin mocks
  en `tests/features/scan/useScanEvents.test.ts`, donde sí se puede llamar
  a `submitScan` con un target arbitrario sin pasar por el formulario.
  Documentado en el encabezado de `e2e/realtime-status.spec.ts`.
- El e2e tampoco asevera sobre el estado intermedio `EN_PROGRESO`: el
  servidor de contrato emite todo el guion en ~20ms
  (`SCAN_EVENT_INTERVAL_MS`), ventana demasiado corta para que aserciones
  de UI con polling lo capturen de forma confiable (confirmado
  empíricamente: en una corrida real, Playwright pasó de `PENDIENTE` a
  `COMPLETADO` sin llegar a leer `EN_PROGRESO`). La secuencia completa y en
  orden si se verifica con instrumentación precisa (sin polling) en el test
  de hook.

## Verificación (orden pedido)

1. `npm run typecheck` → OK, sin errores.
2. `npm run lint` → OK, sin warnings (tuve que corregir un
   `react-hooks/set-state-in-effect` moviendo el reset de estado a render).
3. `npm run format:check` → OK (corregido con `prettier --write` sobre
   `src/features/scan/index.ts`).
4. `npm run test` (vitest) → **15 test files, 59 tests, todos pasan**
   (incluye los 4 tests nuevos de `useScanEvents.test.ts`).
5. `npm run build` → OK, compila sin errores.
6. `npm run test:e2e` (playwright, Chromium instalado en esta sesión vía
   `npx playwright install chromium`) → **7 specs, 7 tests, todos pasan**:
   `scaffolding`, `api-contract` (x2), `auth-session` (x2),
   `scan-request-form`, `realtime-status` (nuevo). Corrido 4 veces
   consecutivas sin flakiness.
7. `./init.sh` → **`[OK] Entorno listo.`** (todas las secciones en verde).

## Archivos relevantes

- `src/features/scan/useScanEvents.ts` (nuevo)
- `src/features/scan/ScanForm.tsx` (modificado)
- `src/features/scan/index.ts` (modificado)
- `tests/features/scan/useScanEvents.test.ts` (nuevo)
- `tests/features/scan/ScanForm.test.tsx` (modificado, ver decisión arriba)
- `e2e/realtime-status.spec.ts` (nuevo)
- `e2e/scan-request-form.spec.ts` (modificado: `getByRole("status")`
  ambiguo → `getByText(...)`)

## Estado

`feature_list.json`: feature 5 queda en `"status": "in_progress"` — no la
marco `done`, corresponde al `reviewer`.
