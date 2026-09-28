# Review — feature 13 `scan_console_redesign`

**Veredicto:** APPROVED

## Verificación de puntos específicos

1. **Cero cambios de lógica.** Confirmado. `git diff -- src/features/scan/ScanForm.tsx`
   solo toca imports (2 nuevos de `@fontsource`, `./scanForm.css`) y JSX/clases.
   `handleSubmit`, `describeSubmitError`, el tipo `SubmitState`, `canSubmit`,
   `CONNECTION_STATUS_LABEL` y las llamadas a `submitScan`/`useScanEvents`/
   `validateScanTarget` son idénticas carácter por carácter a la versión previa.
   `git status --porcelain -- src/features/scan/` solo lista `ScanForm.tsx`
   (modificado) y `scanForm.css` (nuevo) — `validateScanTarget.ts` y
   `useScanEvents.ts` no aparecen tocados en absoluto (diff vacío confirmado).

2. **Valores reutilizados literalmente.** `scanForm.css` define
   `--scan-bg:#0b1220`, `--scan-surface:#131b2c`, `--scan-border:#232e45`,
   `--scan-text:#e7ecf3`, `--scan-text-muted:#8996ac`, `--scan-accent:#38bdf8`
   — hex idénticos a `--home-bg/--home-surface/--home-border/--home-text/
   --home-text-muted/--home-accent` de `src/features/home/home.css`.
   `git diff -- src/features/home/home.css src/index.css` está vacío: no se
   tocó ninguno de los dos archivos fuente de verdad.

3. **Alcance confirmado.** `git diff --stat` para el árbol de trabajo toca
   18 archivos, pero solo `src/features/scan/ScanForm.tsx` y
   `tests/features/scan/ScanForm.test.tsx` están en el árbol de `scan/`
   (más `scanForm.css`, nuevo/sin trackear). Verifiqué con `stat` los
   timestamps de mtime de todos los archivos en cuestión: los del feature
   previo `home_landing_page` (`src/App.tsx`, `src/auth/LoginButton.tsx`,
   `src/auth/ProtectedRoute.tsx`, `e2e/auth-session.spec.ts`,
   `e2e/authHarness/main.tsx`, `e2e/logout.spec.ts`, `tests/App.test.tsx`,
   `tests/auth/*.test.tsx`, `package.json`/`package-lock.json`,
   `nginx.conf.template`) tienen mtime entre 10:16 y 11:58 del mismo día,
   terminando con `progress/impl_home_landing_page.md` a las 11:58. Los
   archivos de esta feature (`scanForm.css`, `ScanForm.tsx`,
   `ScanForm.test.tsx`, `progress/impl_scan_console_redesign.md`) tienen
   mtime entre 15:42 y 16:18, claramente en una sesión posterior separada.
   Esto es coherente con el reporte del implementer: son residuos sin
   commitear de la feature 12, no tocados por esta sesión. Confirmado
   además que `git diff --stat -- src/features/credentials src/features/history
   src/features/report src/auth/LogoutButton.tsx` está vacío — ninguno de
   esos componentes fue tocado.

4. **Contraste WCAG.** Recalculé con la fórmula estándar de luminancia
   relativa (sRGB linealizado, coeficientes 0.2126/0.7152/0.0722):
   - Alert `#fecaca` sobre `#3a1518` → **11.1624:1** (coincide con lo
     reportado, ~11.16:1).
   - Status `#a7f3d0` sobre `#0f2e28` → **11.3571:1** (coincide con lo
     reportado, ~11.36:1).
   Ambos superan holgadamente AAA (7:1). Cifras no inventadas.

5. **Disciplina del acento cian.** `grep -n "scan-accent" scanForm.css`
   confirma su uso solo en: definición de la variable, el bloque
   `:focus-visible` del input (outline + border-color, líneas 109/111),
   el botón de envío (fondo/borde base, líneas 117-118, y su propio
   `:focus-visible`, línea 134), y `.scan-console__live-dot` (línea 170).
   Ningún otro selector lo usa.

6. **Sin dependencia nueva.** `git diff --stat -- package.json
   package-lock.json` sí muestra cambios (2 líneas en `package.json`, 20 en
   el lock), pero corresponden a `@fontsource/ibm-plex-mono`/
   `@fontsource/space-grotesk` — verificado contra
   `progress/impl_home_landing_page.md` (feature 12, ya documentada y
   justificada ahí) y contra el mtime de `package.json` (11:05, dentro de
   la ventana de la feature 12, muy anterior a la sesión de esta feature).
   No es una dependencia nueva de esta feature. Confirmé que
   `node_modules/@fontsource/space-grotesk/latin-500.css` y
   `node_modules/@fontsource/ibm-plex-mono/latin-400.css` ya existen en
   disco.

7. **Build no duplica fuentes.** Ejecuté `rm -rf dist && npm run build`
   (con `VITE_GATEWAY_BASE_URL` seteado): `dist/assets/*.woff*` = 10
   archivos exactos (space-grotesk latin-400/500/700 × woff/woff2,
   ibm-plex-mono latin-400/500 × woff/woff2). Coincide con lo reportado.

8. **Especificidad CSS.** Confirmé que `src/index.css` tiene
   `input[type="text"]:focus-visible` (selector tipo+atributo+pseudo-clase,
   con `outline: none` + `box-shadow` como reemplazo). El selector de
   `scanForm.css` (`input.scan-console__input[type="text"]:focus-visible`,
   tipo+clase+atributo+pseudo-clase) tiene mayor especificidad en la
   categoría B (3 vs 2), gana la cascada sin depender del orden de
   imports — confirmado analíticamente, coherente con el comentario de
   cabecera del propio archivo. `npm run lint`/`build` no arrojan
   advertencias de CSS.

9. **El ajuste de test.** `git diff -- tests/features/scan/ScanForm.test.tsx`
   muestra un único cambio real: el regex pasó de
   `/escaneo encolado\. id: /i` a `/escaneo encolado\. id:/i` (se quitó el
   espacio final), con un comentario explicando el motivo (el `scanId`
   ahora vive en un `<span>` aparte, y el normalizador de Testing Library
   recorta el texto directo del nodo). Sigue verificando que aparece
   "Escaneo encolado. ID:" tras un submit exitoso. Ejecuté
   `npm run test:e2e`: los 14 specs pasan, incluidos
   `e2e/scan-request-form.spec.ts` y `e2e/realtime-status.spec.ts`, sin
   ningún cambio de código en esos archivos (confirmado con
   `git status --porcelain` — no aparecen como modificados).

10. **Accesibilidad.** `:focus-visible` presente y visible en input
    (línea 108-113) y botón (línea 133-136) de `scanForm.css`, con
    `outline: 3px solid var(--scan-accent)` — sin `outline: none` huérfano
    (el único `outline:none` original de `src/index.css` queda
    efectivamente reemplazado por la regla de mayor especificidad de este
    archivo). Estados `:disabled` del input (línea 98-102) y del botón
    (línea 126-131) usan colores distintos (`--scan-text-muted`/
    `--scan-border`) del estado habilitado.

11. Sin `dangerouslySetInnerHTML`, sin `console.*`, sin `any`/`@ts-ignore`
    en `ScanForm.tsx`, `scanForm.css` ni `ScanForm.test.tsx` (grep vacío).

## Verificación independiente ejecutada

- `npm run typecheck` → OK, sin errores.
- `npm run lint` → OK, sin warnings.
- `npm run format:check` → OK.
- `npm run test` → OK, 128/128 tests (28 archivos).
- `npm run build` (con `VITE_GATEWAY_BASE_URL` seteado) → OK, `dist/assets`
  con 10 archivos de fuente, sin duplicados.
- `npm run test:e2e` → OK, 14/14 specs.
- `./init.sh` → verde de punta a punta (verificación de entorno, formato,
  lint, typecheck, tests, build, e2e).

## Checkpoints (`CHECKPOINTS.md`)

- C1: [x] Arnés completo, `./init.sh` exit 0.
- C2: [x] Solo la feature 13 está `in_progress` en `feature_list.json`;
  `progress/current.md` describe la sesión activa coherentemente.
- C3: [x] `src/` solo usa las carpetas previstas; no hay dependencia nueva
  sin justificar en esta sesión (la única dependencia añadida al repo,
  `@fontsource/*`, pertenece y está justificada en la feature 12, no en
  esta); sin `console.log`/`any`/`@ts-ignore` sin justificar en el código
  de esta feature; `typecheck`/`lint` limpios.
- C4: [x] Test de componente existente sigue verificando comportamiento
  real; specs e2e cubren los flujos de usuario y pasan; `npm run test`
  > 0 tests, todos verdes; `npm run build` sin errores.
- C5: [x] No hay archivos sospechosos nuevos sin trackear atribuibles a
  esta feature (`scanForm.css` es el único `??` de esta sesión, es
  intencional); el resto de archivos `M`/`??` en `git status` corresponden
  a la feature previa `home_landing_page`, aún sin commitear, no a esta
  sesión (confirmado por mtime).

## Notas

- La feature se deja en `in_progress` en `feature_list.json`, como
  corresponde: este reviewer no marca `done` (fuera de su rol), pero el
  trabajo cumple todos los criterios de aceptación de la feature 13.
