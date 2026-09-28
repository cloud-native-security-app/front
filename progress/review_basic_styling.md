# Review — feature 11 (basic_styling)

**Veredicto:** APPROVED

## Verificación contra `acceptance` de la feature 11

1. "Hoja de estilos global nueva... importada una sola vez desde `src/main.tsx`, CSS plano" — ✅ `src/index.css` (nuevo, 344 líneas) es CSS plano; `src/main.tsx:5` agrega exactamente `import "./index.css";` (único import, sin CSS-in-JS, sin `style={}` inline en ningún componente de `src/` — verificado con `grep -rn "style={" src/` → 0 resultados, y `grep -rniE "styled-components|emotion" src/ package.json` → 0 resultados).
2. "No se agrega ninguna dependencia nueva a `package.json`" — ✅ `git diff --stat package.json package-lock.json` no muestra cambios.
3. "Custom properties en `:root`... colores distintos para `role=\"alert\"` vs `role=\"status\"`, reutilizando la distinción semántica ya presente" — ✅ `src/index.css:21-55` define la paleta; `src/index.css:311-329` da fondo/borde/texto distintos a `[role="alert"]` (rojo, líneas 319-323) y `[role="status"]` (verde, líneas 325-329), sin ninguna clase nueva. Confirmado contra el markup real: `ScanForm.tsx` (líneas 91,97,101,106), `NetworkCredentialForm.tsx:165`, `NetworkCredentialsListView.tsx:33,66`, `NetworkCredentialsManager.tsx:120,122`, `HistoryTableView.tsx:48,90`, `ReportView.tsx:89,94,102`, `ReportDetails.tsx:45,76`, `ProtectedRoute.tsx:28,32`, `LogoutButton.tsx:60` — todos usan exactamente `role="alert"`/`role="status"`, ninguna clase nueva requerida.
4. "Tipografía con jerarquía, espaciado consistente, inputs/botones/checkbox coherentes con `:disabled` visualmente distinto" — ✅ `index.css:99-127` (h1/h2/h3/p), `:151-236` (form/table como "tarjeta", inputs, checkbox, button), `:200-206` y `:231-236` dan estilo `:disabled` diferenciado (fondo/color/`cursor:not-allowed`) tanto a inputs como a botones — coherente con los múltiples `disabled={isSubmitting}`/`disabled={!canSubmit}` reales en `ScanForm`, `NetworkCredentialForm`, `NetworkCredentialsListView`, `HistoryTableView`, `LogoutButton`.
5. "Layout centrado con ancho máximo... no se rompe en ventana angosta" — ✅ `#root { max-width: var(--content-max-width) /* 960px */; margin: 0 auto }` (`index.css:77-81`); `@media (max-width: 640px)` (`:334-343`) reduce padding y da `overflow-x:auto` a las tablas en vez de desbordar la página.
6. "Estados de foco visibles... sin eliminar el foco por defecto sin reemplazo" — ✅ `index.css:238-255`: `:focus-visible` agrega outline a `a`/`button`/`input`, y para los inputs de texto sustituye el outline por un `box-shadow` equivalente (nunca `outline: none` sin reemplazo). No hay ningún `outline: none` huérfano en el archivo.
7. "No cambia ningún texto, aria/role, estructura ni lógica" — ✅ Verificado por dos vías independientes:
   - `git diff src/main.tsx` → únicamente la línea `+import "./index.css";`.
   - Comparación de `mtime`: todos los componentes de `src/features`, `src/auth` y `src/App.tsx` tienen su última modificación a las 17:17:32 o antes (sesiones previas, features 9/10); los 4 archivos de esta sesión (`feature_list.json`, `src/index.css`, `src/main.tsx`, `progress/current.md`) tienen `mtime` entre 17:32:09 y 17:33:57 — ningún componente fue tocado en la ventana de esta sesión.
   - Lectura íntegra de `ScanForm.tsx`, `NetworkCredentialForm.tsx`, `NetworkCredentialsListView.tsx`, `NetworkCredentialsManager.tsx`, `HistoryTableView.tsx`, `ReportView.tsx`, `ReportDetails.tsx`, `LoginButton.tsx`, `LogoutButton.tsx`, `ProtectedRoute.tsx`, `App.tsx`: markup/aria/estructura/lógica intactos.
8. "`./init.sh` en verde" — ✅ ejecutado en esta revisión, exit code 0: prettier --check OK, eslint sin warnings, `tsc --noEmit` sin errores, 124/124 tests unitarios/de componente (vitest), `npm run build` sin errores, 13/13 specs e2e (Playwright, Chromium real) — incluye `e2e/network-credentials.spec.ts` (usa el checkbox con `label:has(input[type="checkbox"])`), confirmando empíricamente que el selector `:has()` no rompe nada en Chromium.

## CSP (`front/nginx.conf.template`)

✅ Sigue intacta y compatible: `style-src 'self'` sin `unsafe-inline` (línea 20). El build de Vite extrae `src/index.css` a `dist/assets/index-wZmzJlLt.css` + un `<link rel="stylesheet">` en `dist/index.html` (confirmado en la salida de `npm run build`: `dist/assets/index-wZmzJlLt.css 4.48 kB`) — mismo origen, sin script/estilo inline nuevo. `nginx.conf.template` no fue tocado por esta feature y no necesitaba tocarse.

## Checkpoints (`CHECKPOINTS.md`)

### C1 — El arnés está completo
- C1.1: [x] Existen `AGENTS.md`, `init.sh`, `feature_list.json`, `progress/current.md`.
- C1.2: [x] Existen `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`, `docs/security-scope.md`.
- C1.3: [x] `./init.sh` terminó con exit code 0.

### C2 — El estado es coherente
- C2.1: [x] Exactamente una feature en `in_progress` (id 11, `basic_styling`).
- C2.2: [x] Toda feature `done` (1-10) tiene tests asociados y los 124 tests unitarios + 13 e2e pasan.
- C2.3: [x] `progress/current.md` describe la sesión activa (feature 11), sin basura de sesiones previas.

### C3 — El código respeta la arquitectura
- C3.1: [x] `src/` solo contiene `api`, `auth`, `features`, `components`, `routes` + los archivos raíz previstos (`App.tsx`, `main.tsx`, `index.css`, `vite-env.d.ts`).
- C3.2: [x] Ninguna dependencia nueva en `package.json` (verificado: sin diff).
- C3.3: [x] Sin `console.log` de debug en `src/` (único `console.log` del repo está en `e2e/contract-server/main.ts`, servidor de contrato de pruebas, ya justificado como tal en su propio comentario — no es código de producción). Sin `any`/`@ts-ignore` sin justificar.
- C3.4: [x] `npm run typecheck` y `npm run lint` sin errores/warnings (parte de `./init.sh`).

### C4 — La verificación es real
- C4.1: [x] Cobertura de tests preexistente para toda lógica pura/componente con comportamiento (esta feature es puramente visual y el propio `acceptance` dice explícitamente "ningún test existente debería necesitar cambios" — correcto, no aplica agregar tests nuevos para CSS puro).
- C4.2: [x] `e2e/` cubre los flujos de usuario completos (login, escaneo, tiempo real, histórico, cancelación, reporte, logout, credenciales de red), corriendo contra el servidor de contrato real.
- C4.3: [x] `npm run test` → 124/124 verdes.
- C4.4: [x] `npm run build` sin errores.

### C5 — La sesión se cerró bien
- C5.1: [x] No hay archivos sin trackear sospechosos (`git status` solo muestra código fuente legítimo de esta sesión y de sesiones previas sin commitear — features 9/10 — nada de `*.tmp` ni `dist/`/`node_modules` fuera de `.gitignore`).
- C5.2: [ ] `progress/history.md` todavía no tiene entrada para esta sesión — **correcto en este punto del flujo**: `progress/current.md` documenta explícitamente que está "esperando veredicto del reviewer antes de marcar la feature `done`" y archivar a `history.md` es responsabilidad del `leader` una vez recibido este veredicto APPROVED, no de esta revisión.
- C5.3: [ ] La feature 11 sigue en `in_progress` en `feature_list.json`, no en `done` — mismo motivo que C5.2: es correcto que siga así hasta que el `leader` procese este veredicto APPROVED y la cierre.

## Cambios requeridos

Ninguno. La feature 11 (`basic_styling`) cumple los 8 puntos de su `acceptance` bullet a bullet, no introduce dependencias nuevas, no toca ningún componente existente (texto/aria/estructura/lógica intactos), la distinción visual alert/status y el estado `:disabled`/`:focus-visible` están correctamente implementados sin clases nuevas, el layout es centrado y responsivo, la CSP sigue cumpliéndose sin cambios, y `./init.sh` termina en verde (124 tests unitarios + 13 e2e, build limpio). Las únicas casillas sin marcar de C5 son housekeeping de cierre de sesión que corresponde al `leader` ejecutar **después** de este veredicto (mover `current.md` a `history.md`, marcar la feature `done`), no defectos de la implementación.
