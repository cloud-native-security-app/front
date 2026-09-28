# Implementación — feature 13 `scan_console_redesign`

## Qué se implementó

- **`src/features/scan/scanForm.css` (nuevo)**: hoja de estilos plana,
  scoped bajo `.scan-console`. Define localmente las custom properties
  `--scan-bg/--scan-surface/--scan-border/--scan-text/--scan-text-muted/
  --scan-accent` con los mismos valores hex LITERALES que
  `src/features/home/home.css` (`#0b1220`/`#131b2c`/`#232e45`/`#e7ecf3`/
  `#8996ac`/`#38bdf8`), con un comentario de cabecera que cruza la
  referencia explícita a `home.css` para mantener la sincronización manual
  si esos valores cambian a futuro. `home.css`/`src/index.css` **no se
  tocaron** (confirmado con `git diff --stat`, ver más abajo).
- **`src/features/scan/ScanForm.tsx`**: solo cambios de import/JSX/clases:
  - Envuelve el `<form>` existente en un `<section className="scan-console"
    aria-label="Nueva solicitud de escaneo">` con un `<h2
    className="scan-console__heading">Nueva solicitud de escaneo</h2>`
    (copy específico y real, mismo patrón que
    `NetworkCredentialsManager`/`<h2>Credenciales de red</h2>`, con
    `aria-label` de la `section` repitiendo el texto del `<h2>`, igual que
    ese componente vecino).
  - Añade `className` a `label`/`input`/`button`/`form` (`scan-console__
    label|input|submit|form`) — cero cambios de atributos funcionales
    (`id`, `name`, `type`, `value`, `disabled`, `onChange`, `onSubmit`
    intactos).
  - El `scanId` exitoso y la línea "Estado: … (…)" ahora viven dentro de un
    `<span className="scan-console__mono">` (IBM Plex Mono) en vez de texto
    plano directo del `<p>`.
  - El punto "en vivo" (`<span className="scan-console__live-dot"
    aria-hidden="true" />`, mismo patrón visual que
    `.home-page__panel-dot`) se renderiza condicionalmente solo cuando
    `scanEvents.connectionStatus === "open"`, delante de la línea de
    estado.
  - `[role="alert"]`/`[role="status"]` de los `<p>` **no llevan clase
    nueva** — se estilizan vía el selector de atributo `.scan-console
    [role="alert"]` / `.scan-console [role="status"]` en `scanForm.css`,
    tal como pide el criterio de aceptación ("mismos roles semánticos...
    sin clases nuevas para esa distinción").
  - Importa los mismos archivos exactos de fuente que ya usa `HomePage.tsx`
    (`@fontsource/space-grotesk/latin-500.css`,
    `@fontsource/ibm-plex-mono/latin-400.css`) — ningún archivo de fuente
    nuevo, ninguna dependencia nueva en `package.json`.
- **`tests/features/scan/ScanForm.test.tsx`**: un solo ajuste de selector
  (documentado inline con comentario), ver sección "Ajuste de test" abajo.
  El resto de los 3 tests (entrada inválida deshabilita envío sin llamar a
  `submitScan`, entrada válida + éxito muestra el `scanId`, submit fallido
  muestra el error explícito) sigue verificando exactamente lo mismo.

## Decisiones de diseño

### Estructura visual

- El `<section className="scan-console">` pinta su propio fondo
  `--scan-bg` (`#0b1220`, el mismo "page background" que usa `.home-page`)
  con borde `--scan-border` y una sombra sutil
  (`box-shadow: 0 18px 40px -28px rgba(0,0,0,.7)`, monocromática, sin
  introducir ningún nuevo color) — la isla oscura completa. Dentro, el
  `<form className="scan-console__form">` usa `--scan-surface` (`#131b2c`,
  el mismo "panel surface" que usa `.home-page__panel`), replicando la
  misma relación bg/surface de dos tonos que ya existe en `home.css` en vez
  de inventar una nueva. El `<input>` usa `--scan-bg` como fondo (un tono
  más "hundido" que la superficie del formulario), reforzando la metáfora
  de "campo de entrada de terminal".
- Radios de borde (`4px`) y el hex de hover del acento (`#7dd4fb`) se
  reusan literalmente de `home.css` (no son valores nuevos inventados).
- Heading elegido: **"Nueva solicitud de escaneo"** (no genérico tipo
  "Formulario") — refleja el vocabulario ya usado en
  `docs/architecture.md`/el comentario de cabecera original de
  `ScanForm.tsx` ("formulario de nueva solicitud de escaneo"), y es
  paralelo al patrón de `NetworkCredentialsManager` (`<h2>Credenciales de
  red</h2>` + `aria-label` idéntico en la `section`).

### Colores alert/status recalibrados (nunca copiados de `src/index.css`)

Verificados con la fórmula de luminancia relativa WCAG (sRGB linealizado):

- **Alert**: `--scan-alert-bg: #3a1518` (rojo muy oscuro), `--scan-alert-
  border: #f87171`, `--scan-alert-text: #fecaca`. Contraste texto/fondo
  calculado: **≈11.16:1** (supera holgadamente el mínimo AA de 4.5:1, nivel
  AAA).
- **Status**: `--scan-status-bg: #0f2e28` (verde muy oscuro), `--scan-
  status-border: #34d399`, `--scan-status-text: #a7f3d0`. Contraste
  calculado: **≈11.36:1**.
- Mismo rol semántico que `--color-alert-*`/`--color-status-*` de
  `src/index.css` (rojo = alerta, verde = éxito/estado), pero con
  luminosidad totalmente recalculada para una superficie oscura en vez de
  reusar esos hex (que darían ~1.5:1 sobre `#131b2c`, ilegibles).
- Aplicados vía `.scan-console [role="alert"]` / `.scan-console
  [role="status"]` (selector de atributo scoped, sin clase nueva).

### Especificidad CSS (nota técnica)

`src/index.css` estiliza `input[type="text"]` combinando selector de tipo +
atributo (y sumando `:disabled`/`:focus-visible`), lo que le da más
especificidad que una clase sola. Para ganar la cascada de forma
determinista (sin depender del orden de imports entre `index.css` y
`scanForm.css`), los selectores del input en `scanForm.css` replican esa
misma forma: `input.scan-console__input[type="text"]` (+ `:disabled`/
`:focus-visible`). Confirmado visualmente vía el DOM renderizado en los
tests (fondo/borde/tipografía del input sí cambian).

### Accesibilidad

- `input.scan-console__input[type="text"]:focus-visible` reemplaza el
  `outline: none` + `box-shadow` de `src/index.css` por
  `outline: 3px solid var(--scan-accent)` (mismo tratamiento que
  `.home-page a:focus-visible`/`.home-page__cta:focus-visible`) — nunca se
  deja sin indicador de foco.
- `.scan-console__submit:focus-visible` idem.
- Estados `:disabled` (input mientras `isSubmitting`, botón mientras
  `!canSubmit`) usan `--scan-text-muted`/`--scan-border`, visualmente
  distintos del estado habilitado.

### Disciplina del acento cian

`--scan-accent` (`#38bdf8`) solo aparece en: el botón de envío
(`.scan-console__submit`, más su hover `#7dd4fb`, reusado de `home.css`),
el punto "en vivo" (`.scan-console__live-dot`, solo si `connectionStatus
=== "open"`), y `:focus-visible` de input/botón. Ningún otro lugar.

## Ajuste de test (`tests/features/scan/ScanForm.test.tsx`)

El único cambio: en
`entrada_valida_y_submit_exitoso_muestra_el_scanId`, el matcher pasó de
`/escaneo encolado\. id: /i` (con espacio final literal) a `/escaneo
encolado\. id:/i` (sin ese espacio). Motivo: ahora el `scanId` vive en un
`<span>` aparte (para poder darle fuente monoespaciada), así que el texto
directo del `<p role="status">` que lo envuelve es solo "Escaneo encolado.
ID:" + un nodo de texto separado con un único espacio — el normalizador
por defecto de Testing Library recorta (`trim()`) los extremos del texto
propio del nodo antes de compararlo con el regex, así que ese espacio final
se pierde en la comparación. El comportamiento verificado no cambió (sigue
comprobando que aparece "Escaneo encolado. ID:" tras un submit exitoso);
solo se ajustó el selector por el cambio de estructura del DOM, como
permite explícitamente el criterio de aceptación de la feature. Los specs
e2e (`e2e/scan-request-form.spec.ts`, `e2e/realtime-status.spec.ts`,
`e2e/scan-history.spec.ts`, `e2e/report-view.spec.ts`) que usan la misma
clase de matcher **no necesitaron ajuste**: Playwright's `getByText`
concatena el texto completo (incluyendo descendientes) del elemento más
pequeño que lo contiene, a diferencia del comportamiento por defecto de
Testing Library (solo nodos de texto directos), así que el espacio interno
antes del `scanId` sigue presente en la comparación.

## Verificación (en orden)

1. `npm run typecheck` → **OK**, sin errores.
2. `npm run lint` → **OK**, sin warnings.
3. `npm run format:check` → **OK** tras `prettier --write` sobre
   `ScanForm.tsx` (el resto de archivos ya estaba formateado).
4. `npm run test` → **OK**, 128/128 tests (28 archivos), incluyendo el
   ajuste documentado arriba.
5. `npm run build` → **OK**. `dist/assets/` contiene exactamente 10
   archivos de fuente (`space-grotesk` latin-400/500/700 × {woff,woff2} +
   `ibm-plex-mono` latin-400/500 × {woff,woff2}) — el mismo conjunto que ya
   generaba `home_landing_page` por sí sola (`ScanForm` solo reimporta
   subsets ya usados por `HomePage`, `latin-500` de space-grotesk y
   `latin-400` de ibm-plex-mono; Vite los dedupea a los mismos assets, cero
   archivos nuevos).
6. `npm run test:e2e` → **OK**, 14/14 specs pasan (sin cambios de
   comportamiento; se corrieron los mismos 14 specs previos a esta
   feature).
7. `./init.sh` → **OK**, verde de punta a punta (format → lint → typecheck
   → test → build → test:e2e).

## Confirmación de alcance (`git diff --stat` tras el trabajo)

Archivos tocados por esta sesión, exclusivamente:

- `src/features/scan/ScanForm.tsx` (modificado)
- `src/features/scan/scanForm.css` (nuevo)
- `tests/features/scan/ScanForm.test.tsx` (modificado, 1 ajuste de
  selector documentado arriba)

**No se tocaron** (verificado): `src/features/credentials/
NetworkCredentialsManager.tsx`, `src/features/history/*`, `src/features/
report/*`, `src/auth/LogoutButton.tsx`, `src/index.css`, `src/features/
home/home.css`. El resto de archivos que aparecen como `M`/`??` en `git
status` (p. ej. `src/App.tsx`, `src/auth/LoginButton.tsx`,
`src/auth/ProtectedRoute.tsx`, `e2e/home.spec.ts`, `src/features/home/`,
`package.json`, etc.) ya estaban modificados/sin trackear **antes** de que
esta sesión empezara (son el resultado de la feature previa
`home_landing_page`, id 12, aún sin commitear) — no forman parte de este
diff de feature 13.

## Estado

`feature_list.json` → feature 13 se deja en `"in_progress"` (no se marca
`done`, corresponde al `reviewer`).
