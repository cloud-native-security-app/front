# Review — feature 16 (history_polling_refresh)

**Veredicto:** APPROVED

## Checkpoints

- C1: [x] `AGENTS.md`, `init.sh`, `feature_list.json`, `progress/current.md`
      existen; los 4 docs existen; `./init.sh` termina con exit code 0
      (verificado: `echo $?` → `0`).
- C2: [x] Solo la feature 16 está `in_progress` (resto: 1-15 `done`, 17
      `pending`). `progress/current.md` describe la sesión activa, sin
      basura de sesiones anteriores.
- C3: [x] `src/` solo tiene `api`, `auth`, `components`, `features`,
      `routes`. Sin dependencias nuevas en `package.json` (sin diff).
      Sin `console.log`, `any` ni `@ts-ignore` sueltos en los archivos
      tocados (`rg` no encontró coincidencias). `npm run typecheck` y
      `npm run lint` sin errores/warnings.
- C4: [x] `tests/features/history/HistoryTablePolling.test.tsx` cubre
      ambos casos del criterio de aceptación contra el servidor de
      contrato real (`useContractServer`, sin `vi.mock` de `src/api`).
      `npm test` → 30 archivos / 133 tests, todos verdes. `npm run build`
      genera sin errores (confirmado dentro de `./init.sh`).
- C5: [x] No hay archivos sueltos sospechosos (`*.tmp`, `dist/`,
      `node_modules/`); los únicos `??` son el informe del implementer y
      el test nuevo, ambos esperados. La feature queda correctamente en
      `in_progress` a la espera de este veredicto (no se marcó `done`
      prematuramente).

## Verificación realizada

1. `git diff --stat`: toca `src/features/history/HistoryTable.tsx` (único
   archivo de código) y añade `tests/features/history/HistoryTablePolling.test.tsx`.
   También aparecen `feature_list.json` (cambio de status a `in_progress`,
   esperado del leader) y `progress/current.md` (bitácora de sesión,
   esperado). Ver nota en "Observación no bloqueante" sobre `.gitignore`.
2. Lectura completa de `HistoryTable.tsx`: el segundo `useEffect` solo crea
   el `setInterval` cuando `isPolling` (`state.status === "loaded" &&
   hasNonTerminalEntries(state.entries)`) es `true`; si es `false` retorna
   temprano sin crear nada. El cleanup limpia el intervalo tanto al
   desmontar como en cada re-renderizado donde `isPolling` cambia de valor
   (React re-ejecuta el efecto por cambio de dependencia), por lo que se
   detiene solo al quedar todo terminal y se reactiva solo si reaparece una
   entrada no terminal. Usa el mismo patrón `active` que el efecto de carga
   inicial para evitar `setState` tras desmontar, y `clearInterval` en el
   cleanup — consistente con el resto del archivo.
3. `handleCancel` no fue tocado: el refetch inmediato tras `cancelScan`
   exitoso (líneas 162-163) permanece igual.
4. Sin `EventSource`/SSE nuevo (`rg` confirma; el JSDoc del componente
   documenta explícitamente por qué se mantiene el refetch simple).
5. Los dos tests nuevos prueban lo que dicen: el primero cambia el estado
   real en el servidor de contrato fuera del componente (`cancelScan`
   directo) y confirma que `advanceTimersByTimeAsync(7000)` dispara un
   refetch que actualiza la fila a `FALLIDO`; el segundo monta con todo
   terminal, encola un segundo escaneo directo contra el servidor de
   contrato, avanza el tiempo, y confirma que esa entrada nunca aparece
   (el polling nunca se activó). Ambos usan `useContractServer` real, sin
   mocks de `src/api`.
6. Corrí `npx vitest run tests/features/history/HistoryTablePolling.test.tsx`
   5 veces consecutivas de forma aislada: 2/2 tests verdes las 5 veces, sin
   intermitencia. La justificación de acotar
   `vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })` (en vez
   de fakear todo, porque `fetch`/`undici` depende de `setTimeout` real) es
   coherente con el comportamiento observado y no es frágil en la práctica.
7. Ejecuté yo mismo: `npm run typecheck` (verde), `npm run lint` (verde,
   sin warnings), `npm run format:check` (verde), `npm test` (30
   archivos / 133 tests, verde) y `./init.sh` completo (format, lint,
   typecheck, unit tests, build, 14 tests e2e con playwright) — exit code
   0 de punta a punta.

## Observación no bloqueante

`git diff .gitignore` muestra una línea nueva (`.atl`) sin relación
aparente con esta feature y no mencionada en
`progress/impl_history_polling_refresh.md` (que afirma que "ningún otro
componente/feature fue modificado"). No es un hallazgo de seguridad ni de
arquitectura — no toca `src/`/`tests/`, no persiste nada sensible — pero
es una imprecisión menor en el informe del implementer. Sugerencia para el
leader: confirmar el origen de ese cambio (¿sesión anterior, herramienta
local?) antes de commitear, o documentarlo si es intencional.

## Cambios requeridos (si aplica)

Ninguno. La feature cumple el criterio de aceptación completo y no viola
`docs/architecture.md`, `docs/conventions.md` ni `docs/security-scope.md`.
