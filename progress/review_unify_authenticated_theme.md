# Review — feature 17 unify_authenticated_theme

**Veredicto:** APPROVED

## Análisis del punto crítico: `home.css` sin herencia real

Verifiqué yo mismo `src/auth/ProtectedRoute.tsx` y `src/App.tsx`:
`ProtectedRoute` es un `if/else` puro —
`if (status === "anonymous") return <>{anonymousView}</>;` ... `return
<>{children}</>;` — nunca ambas ramas coexisten en el DOM. `HomePage`
(`anonymousView`) y `<div className="app-shell--authenticated">`
(`children`) son alternativas mutuamente excluyentes. No existe forma de
lograr herencia CSS real de `.app-shell--authenticated` hacia `.home-page`
sin que ambos elementos compartan un ancestro común en el árbol renderizado
en un momento dado — y forzar esa coexistencia (p. ej. montar el wrapper
siempre y condicionar solo el contenido interno) sí sería "reestructurar la
lógica existente de `ProtectedRoute`/`App.tsx`", violando explícitamente la
primera cláusula del acceptance. Tampoco hay forma de resolverlo moviendo
la redefinición a `src/auth` sin violar el límite de capas
(`src/auth` nunca importa de `src/features/home`, documentado en el propio
comentario de cabecera de `ProtectedRoute.tsx`).

Confirmado: es un límite técnico real, no una resignación prematura del
implementer. La interpretación aplicada — renombrar `--home-*` a
`--color-*` (mismo valor hex, cero cambio visual) para que ambos temas
oscuros compartan vocabulario, eliminando la duplicación de *nombres* que
antes existía entre `--scan-*`/`--home-*` — cumple razonablemente el
espíritu del criterio (eliminar la fragmentación de vocabulario que
`scanForm.css` documentaba como "sincronización manual"), aunque no logra
la herencia literal que describe la letra del acceptance. El implementer
documentó la decisión explícitamente en
`progress/impl_unify_authenticated_theme.md` en vez de forzar un cambio
fuera de alcance o fingir cumplimiento. Acepto esta interpretación.

## Resto de puntos verificados

1. `git diff --stat` solo toca `src/App.tsx`, `src/index.css`,
   `src/features/scan/scanForm.css`, `src/features/home/home.css` (más
   `feature_list.json`/`progress/current.md`, bookkeeping del leader).
   Nada en `history/`, `credentials/`, `report/`, `auth/LogoutButton.tsx`,
   `auth/ProtectedRoute.tsx`, `tests/`, `e2e/`.
2. `App.tsx`: el wrapper `app-shell--authenticated` envuelve exactamente
   el JSX que ya existía (`<h1>`, `LogoutButton`,
   `NetworkCredentialsManager`, `ScanForm`, `HistoryTable`, `ReportView`
   condicional) — cero cambios de estado o lógica, confirmado por diff
   línea por línea.
3. `src/index.css`: los valores hex del bloque `.app-shell--authenticated`
   (`#0b1220`, `#131b2c`, `#232e45`, `#e7ecf3`, `#8996ac`, `#38bdf8`,
   `#7dd4fb`, `#3a1518`/`#f87171`/`#fecaca`, `#0f2e28`/`#34d399`/`#a7f3d0`)
   coinciden exactamente, carácter por carácter, con los documentados en
   `progress/impl_scan_console_redesign.md` (líneas 77-82) para
   `--scan-alert-*`/`--scan-status-*` — no se recalculó ni inventó ningún
   valor. El selector de espaciado `main > *` se extendió correctamente a
   `.app-shell--authenticated > *` (y su `:last-child`); no rompe el
   espaciado vertical, confirmado tanto por lectura del CSS como por la
   captura visual (sección 7).
4. `scanForm.css`: ya no declara `--scan-*`; las reglas
   `.scan-console [role="alert"]`/`[role="status"]` se eliminaron porque el
   selector genérico `[role="alert"]`/`[role="status"]` de `index.css` lee
   `var(--color-alert-*)`/`var(--color-status-*)`, que dentro de
   `.app-shell--authenticated` resuelven a los mismos valores recalibrados
   — sin pérdida de contraste, confirmado por lectura del CSS y por la
   captura (mensaje de estado del histórico, verde legible sobre fondo
   oscuro).
5. Sin dependencias nuevas en `package.json`/`package-lock.json`, sin
   cambios de markup/aria en componentes no tocados, sin `console.log`,
   sin `any`/`@ts-ignore` nuevos.
6. Ejecuté yo mismo: `npm run typecheck` (OK), y `./init.sh` completo —
   prettier, eslint, tsc, 133/133 tests unitarios (30 archivos), build
   (OK, `dist/assets/` con los mismos 10 archivos de fuentes, sin
   duplicados), 14/14 e2e — todo verde.
7. Verificación visual: spec temporal de Playwright
   (`e2e/_tmp_review_visual_check.spec.ts`, creado, ejecutado, capturado
   screenshot, y borrado antes de cerrar) con sesión sintética real +
   credencial creada. Resultado: `LogoutButton` (cian sobre fondo oscuro),
   `NetworkCredentialsManager` (form + tabla oscuros, texto y fila
   legibles), `ScanForm` (misma paleta, isla con borde/sombra propios), y
   el `role="status"` de `HistoryTable` ("Todavía no hay escaneos...")
   verde legible sobre fondo oscuro — todo coherente, sin bloques claros
   visibles.
8. `git status --short` confirmado limpio de archivos temporales al
   finalizar esta revisión (el spec y el PNG de verificación se borraron).

## Checkpoints

- C1: [x] — 4 archivos base + 4 docs presentes; `./init.sh` exit 0.
- C2: [x] — 1 sola feature `in_progress` (17); tests de features `done`
  pasan (133/133); `progress/current.md` describe la sesión activa sin
  basura de sesiones previas.
- C3: [x] — `src/` solo tiene `api`/`auth`/`features`/`components`/
  `routes` + los archivos raíz esperados; sin dependencias nuevas; sin
  `console.log`/`any`/`@ts-ignore` sin justificar; `typecheck`/`lint`
  limpios.
- C4: [x] — `tests/`/`e2e/` sin cambios porque ningún comportamiento
  cambió (solo CSS/wrapper), y así lo confirma el implementer y esta
  revisión; `npm test`/`npm run test:e2e` > 0 y todos verdes; `build` sin
  errores.
- C5: [x] — sin archivos sin trackear sospechosos tras limpiar el spec
  temporal; `progress/current.md` refleja la feature en curso
  correctamente (pendiente de que el leader actualice a `done` y mueva la
  entrada a `history.md` tras este veredicto).
