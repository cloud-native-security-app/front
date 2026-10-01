# Implementación — feature 17 `unify_authenticated_theme`

## Qué se implementó

- **`src/App.tsx`**: se agregó `<div className="app-shell--authenticated">`
  envolviendo exactamente el mismo JSX que ya vivía dentro de
  `ProtectedRoute` (`<h1>front</h1>`, `LogoutButton`,
  `NetworkCredentialsManager`, `ScanForm`, `HistoryTable`, `ReportView`
  condicional). Cero cambios de estado/lógica — solo el wrapper y el
  comentario de cabecera actualizado documentando la nueva feature.
- **`src/index.css`**: nuevo bloque `.app-shell--authenticated` (justo
  después del espaciado `main > *`) que redefine
  `--color-bg/--color-surface/--color-border/--color-text/
  --color-text-muted/--color-accent/--color-accent-hover/
  --color-accent-contrast/--color-alert-*/--color-status-*` con los mismos
  valores hex LITERALES que antes vivían en `--scan-*`
  (`scanForm.css`)/`--home-*` (`home.css`). Como los selectores genéricos
  de este archivo (`form`, `table`, `button`, `input`, `[role="alert"]`,
  `[role="status"]`, etc.) ya leen `var(--color-*)`, esto reteñe
  `HistoryTable`/`NetworkCredentialsManager`/`ReportView`/`LogoutButton`
  sin tocar su markup ni sus estilos propios.
  - Incluye un `::before` con `position: fixed; inset: 0;` (mismo patrón
    que `.home-page::before`) para que no quede un borde claro visible
    alrededor del padding de `#root` — sin este detalle, el dashboard
    autenticado se vería con un marco claro alrededor del contenido oscuro,
    exactamente el "quiebre a medio terminar" que esta feature busca
    eliminar.
  - Ajuste necesario no listado explícitamente en el acceptance pero
    consecuencia directa de envolver todo en un único `<div>`: el selector
    `main > * { margin-bottom: var(--space-6); }` /
    `main > *:last-child { margin-bottom: 0; }` (espaciado entre
    `LogoutButton`/`NetworkCredentialsManager`/`ScanForm`/`HistoryTable`/
    `ReportView`, antes hijos directos de `<main>`) se extendió a
    `.app-shell--authenticated > *` / `.app-shell--authenticated > *:last-child`
    para que ese mismo espaciado se preserve ahora que esos elementos son
    hijos del wrapper en vez de hijos directos de `<main>`. Sin este
    ajuste se habría perdido todo el espaciado vertical entre secciones.
- **`src/features/scan/scanForm.css`**: `.scan-console` deja de declarar su
  propio set `--scan-*`. Como `ScanForm` se monta dentro del nuevo wrapper
  en el DOM, `.scan-console` hereda `--color-*` por cascada normal de
  custom properties — el archivo solo las consume (`var(--color-bg)`,
  `var(--color-surface)`, etc.). Como consecuencia directa, las reglas
  `.scan-console [role="alert"]` / `.scan-console [role="status"]` (que
  antes existían solo para recalibrar esos colores para fondo oscuro)
  quedaron completamente redundantes — el selector genérico `[role="alert"]`/
  `[role="status"]` de `index.css` ya resuelve exactamente los mismos
  valores dentro del wrapper — y se eliminaron. El hover hardcodeado
  `#7dd4fb` de `.scan-console__submit:hover` pasó a `var(--color-accent-hover)`.
- **`src/features/home/home.css`**: renombradas todas las variables
  `--home-*` a `--color-*` (mismos valores hex, cero cambio visual).
  `.home-page` NO está anidado dentro de `.app-shell--authenticated` (son
  dos ramas mutuamente excluyentes de `ProtectedRoute`: anónimo vs.
  autenticado, nunca coexisten en el DOM), así que sigue siendo una
  redefinición LOCAL bajo `.home-page` — el objetivo de esta feature para
  `home.css` es eliminar el nombre paralelo (`--home-*` vs. `--scan-*`), no
  lograr una herencia real imposible entre ramas excluyentes. Se añadió
  `--color-accent-hover: #7dd4fb` (no existía como variable en `home.css`,
  el hover del CTA usaba el hex suelto) para eliminar ese otro hex
  duplicado, ya que la misma constante ahora tiene nombre compartido con la
  del wrapper.

## Decisión de diseño: por qué `home.css` sigue redefiniendo localmente

El acceptance dice "scanForm.css y home.css ... pasan a consumir las mismas
`--color-*` ya redefinidas por el wrapper". Para `scanForm.css` esto es
literal: `.scan-console` es descendiente real de `.app-shell--authenticated`
en el DOM, así que hereda las variables sin declarar nada. Para `home.css`
es estructuralmente imposible de forma literal: `HomePage` es el
`anonymousView` de `ProtectedRoute` y nunca se monta junto al wrapper
autenticado (son alternativas, no anidadas) — reestructurar `ProtectedRoute`
para forzar esa herencia habría violado "no se reestructura el estado ni la
lógica existente de `App.tsx`" y la capa `src/auth` nunca debe importar de
`src/features/home` (`docs/architecture.md`). La interpretación aplicada:
compartir el **nombre** canónico `--color-*` entre ambos temas oscuros
(eliminando la duplicación de vocabulario `--scan-*`/`--home-*` que
`scanForm.css` documentaba como "sincronización manual") es el límite
técnico real de lo pedido; el valor hex sigue necesitando una declaración
local en `home.css` porque esa rama vive fuera del wrapper.

## Verificación

1. `npm run typecheck` → OK, sin errores.
2. `npm run lint` → OK, sin warnings.
3. `npm run format:check` → OK (tras corregir un comentario en
   `scanForm.css` que contenía literalmente la secuencia `*/` dentro de una
   lista de nombres de variables separados por `/`, lo que cerraba el
   comentario CSS antes de tiempo para el parser de Prettier/PostCSS — se
   reescribió el comentario para no yuxtaponer `*` y `/` sin un backtick
   entre medio).
4. `npm test` → OK, 133/133 tests (30 archivos). Ningún test existente
   necesitó ajuste: ninguno de los tests de
   `HistoryTable`/`NetworkCredentialsManager`/`ReportView`/`LogoutButton`/
   `ScanForm`/`App` depende de colores o de la paleta clara/oscura, solo de
   contenido/roles/comportamiento.
5. `npm run build` → OK. `dist/assets/` sigue con exactamente los mismos 10
   archivos de fuente que antes de esta feature (Space Grotesk × 3 +
   IBM Plex Mono × 2, cada uno en woff/woff2) — cero duplicados.
6. `npm run test:e2e` → OK, 14/14 specs (sin cambios de comportamiento).
7. `./init.sh` → OK, verde de punta a punta (format → lint → typecheck →
   test → build → test:e2e), ejecutado dos veces (antes y después de
   limpiar el spec temporal de verificación visual).
8. **Verificación visual manual** (Playwright, spec temporal
   `e2e/_tmp_visual_check.spec.ts`, creado, ejecutado una vez para capturar
   un screenshot de pantalla completa autenticada, y **borrado** antes de
   cerrar la sesión — no forma parte del diff final): sesión sintética +
   navegar a `/`, crear una credencial de red, y capturar la página
   completa. Resultado: `LogoutButton` (cian sobre fondo oscuro),
   `NetworkCredentialsManager` (tabla y formulario oscuros, texto legible,
   fila con la credencial creada legible), `ScanForm` (su propia isla con
   borde/sombra, ahora del MISMO tono que el resto en vez de contrastar),
   e `HistoryTable` (mensaje `role="status"` "Todavía no hay escaneos en tu
   histórico" con el verde recalibrado, legible sobre fondo oscuro) — todo
   consistente, sin ningún bloque claro visible. `git status --short`
   confirmado limpio de ese archivo temporal al finalizar.

## Confirmación de alcance (`git diff --stat` tras el trabajo)

Archivos tocados por esta sesión, exclusivamente:

- `src/App.tsx` (modificado: wrapper + comentario)
- `src/index.css` (modificado: nuevo bloque `.app-shell--authenticated` +
  extensión del selector de espaciado + comentario de cabecera)
- `src/features/scan/scanForm.css` (modificado: variables renombradas,
  reglas `[role]` redundantes eliminadas, comentario actualizado)
- `src/features/home/home.css` (modificado: variables renombradas,
  `--color-accent-hover` añadida, comentario actualizado)

**No se tocaron**: `src/features/history/*`, `src/features/credentials/
NetworkCredentialsManager.tsx`, `src/features/report/*`,
`src/auth/LogoutButton.tsx`, `src/auth/ProtectedRoute.tsx`, ningún test en
`tests/`/`e2e/` (ninguno necesitó ajuste).

## Estado

`feature_list.json` → feature 17 se deja en `"in_progress"` (no se marca
`done`, corresponde al `reviewer`).
