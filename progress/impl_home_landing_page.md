# Implementación — feature 12: `home_landing_page`

> Estado dejado en `feature_list.json`: **`in_progress`** (el `reviewer`
> decide si pasa a `done`).

## Qué se implementó

### 1. `ProtectedRoute` gana `anonymousView` (elimina el auto-redirect)

`src/auth/ProtectedRoute.tsx`: se añadió la prop obligatoria
`anonymousView: ReactNode`. En `status === "anonymous"` ahora renderiza ese
nodo en vez de hacer `useEffect` + `window.location.href =
loginRedirectUrl()` (ambos eliminados, junto con el import de
`loginRedirectUrl`). El caso `"loading"` no cambió. `src/auth` sigue sin
importar nada de `src/features/*` — quien arma `anonymousView` es quien
compone (`src/App.tsx`, y el harness de e2e).

### 2. `LoginButton` gana props opcionales `label`/`className`

`src/auth/LoginButton.tsx`: ajuste mínimo, no se tocó la navegación
(`window.location.href = loginRedirectUrl()`, nunca un `fetch`). Se agregó
`label` (default `"Iniciar sesión con Google"`, texto sin cambios para el
uso existente) y `className` (default `undefined`) para que `HomePage`
reutilice el mismo componente como su CTA con el copy exacto de la feature
("Iniciar sesión") y una clase de layout — sin reimplementar un segundo
botón de login. Se evaluó primero un wrapper puramente CSS en `HomePage`
(sin tocar `LoginButton.tsx`), pero el texto del botón está hardcodeado
dentro del propio componente, así que un wrapper no podía cambiarlo; de ahí
la necesidad de esta prop mínima.

### 3. `src/features/home/` (nuevo)

- `HomePage.tsx`: estructura semántica (marca "front", `<h1>` titular, lede,
  CTA `LoginButton`, lista de 3 capacidades, panel "Escaneo en vivo",
  footer). Copy usado literalmente, tal cual el objeto de la feature 12 en
  `feature_list.json` (titular, lede, CTA, label del panel, las 3 líneas de
  capacidad, el pie) — no se parafraseó nada.
- `home.css`: CSS plano, todo bajo el scope `.home-page`. Paleta local
  (`--home-bg`, `--home-surface`, `--home-border`, `--home-text`,
  `--home-text-muted`, `--home-accent`) definida solo en este archivo —
  `src/index.css` no se tocó. El acento cian se usa únicamente en: CTA
  (fondo/borde/hover), el punto "en vivo" del panel, y el foco/hover de
  enlaces (incluye el CTA, que es un `<button>` estilizado como tal).
- `index.ts`: barrel, exporta `HomePage`.

**Panel "Escaneo en vivo":** contenido decorativo/simulado
(`EXAMPLE_LIVE_SCAN_LINES` en `HomePage.tsx`, comentario explícito de que no
proviene de ninguna llamada real al Gateway — esta página se sirve a un
visitante sin sesión). La animación de revelado (`home.css`,
`@keyframes home-page-line-cycle`) usa un único ciclo de 8s con
`animation-delay` **negativo** distinto por línea (`nth-child`), técnica
estándar para desfasar una animación `infinite` de forma estable en cada
vuelta del loop sin JavaScript. Es el único momento de movimiento de la
página (nada más se anima: el hover del CTA es una transición de color
implícita del navegador, no una animación orquestada). Bajo
`@media (prefers-reduced-motion: reduce)` se fuerza `animation: none;
opacity: 1` — todas las líneas se muestran de inmediato, nunca ocultas
detrás de una animación que no corre.

**Layout:** asimétrico, alineado a la izquierda. `.home-page__shell` es un
grid `1fr` en mobile (el panel se apila debajo del contenido de texto) y
`3fr 2fr` desde `60rem`, con el panel desplazado `margin-top: 3rem`
respecto al bloque de texto (la asimetría la da el panel, no un elemento
decorativo aparte). El fondo oscuro de borde a borde se logra con una capa
`.home-page::before { position: fixed; inset: 0 }` en vez de pelear con el
`margin`/`padding` de `#root` (`src/index.css` define
`main > *:last-child { margin-bottom: 0 }`, con más especificidad que
cualquier margen negativo que se intentara poner en `.home-page` — ver
comentario en `home.css`). Esta capa fija cubre siempre el viewport
completo sin importar el padding del contenedor ni el scroll, verificado
visualmente con capturas de Playwright en 1440×900 y 375×812 (con scroll
real, no solo `fullPage`, que en Chromium expande el viewport temporalmente
y puede producir un artefacto de captura engañoso con `position: fixed`
que no ocurre en un navegador real).

### 4. `src/App.tsx`

`anonymousView={<HomePage />}` pasado a `ProtectedRoute`. El `<h1>front</h1>`
que vivía fuera de `ProtectedRoute` se movió dentro de los `children`
(rama autenticada) — `HomePage` ya trae su propia marca "front" en su
diseño, así que ya no hay duplicado sin estilo.

## Dependencia nueva: `@fontsource/space-grotesk` y `@fontsource/ibm-plex-mono`

Versión exacta `5.3.0` (sin `^`, mismo criterio de homogeneidad que el
resto de `package.json`). Justificación (`docs/security-scope.md`,
"cualquier paquete npm nuevo se justifica"): la dirección visual acordada
con el usuario ("Signals & Traces") pide Space Grotesk (titular/cuerpo) e
IBM Plex Mono (panel técnico) — ninguna está preinstalada ni es una fuente
de sistema. `@fontsource/*` empaqueta los archivos `.woff`/`.woff2` y su
`@font-face` como CSS estático — **cero JS en runtime, cero llamada a un
dominio de terceros** (nunca Google Fonts ni un CDN), coherente con
`docs/security-scope.md` ("no se añade un dominio de terceros sin
aprobación explícita") — esta dependencia está pre-aprobada explícitamente
para esta feature. Se importan solo los subsets `latin-*.css` (cubre
vocales acentuadas y "ñ", suficiente para el copy en español) en vez de los
`*.css` genéricos, que habrían empaquetado también cyrillic/greek/vietnamese
sin necesidad — el build pasó de 34 archivos de fuente (~290 KB) a 10
(~145 KB). Se confirmó `nginx.conf.template` ya tenía `font-src 'self'`
(lo añadió el leader antes de esta sesión).

**Verificación de CSP con las fuentes reales:** se construyó la imagen
Docker real (`docker build --build-arg VITE_GATEWAY_BASE_URL=... .`) y se
sirvió con `docker run`. Se visitó con Chromium (Playwright) contra la CSP
real de `nginx.conf.template` y se capturaron los mensajes de consola: cero
mensajes que contengan "Content Security Policy" (el único mensaje de
consola fue un `ERR_CONNECTION_REFUSED` esperado de `/api/me`, porque no
había Gateway/servidor de contrato corriendo en ese puerto — irrelevante
para fuentes/CSP). `curl -I` confirmó el header `Content-Security-Policy`
servido incluye `font-src 'self'`.

## Ajustes a tests de features ya `done` (documentados en cada archivo)

1. **`tests/auth/ProtectedRoute.test.tsx`**: el caso `anonymous` ya no
   verifica una asignación a `window.location.href` — verifica que se
   renderiza `anonymousView`, usando un stub simple
   (`<p>vista anónima de prueba</p>`) en vez del `HomePage` real, para
   mantener el test desacoplado.
2. **`tests/App.test.tsx`**: el caso anónimo pasa de "se redirige" a "se
   renderiza `HomePage` con su CTA visible" (`getByRole("heading", ...)`
   con el titular literal + botón "Iniciar sesión"); el caso autenticado
   ahora también verifica el `<h1>front</h1>` (se movió dentro de la rama
   autenticada).
3. **`e2e/auth-session.spec.ts`**: el test
   `usuario_sin_sesion_es_redirigido_a_login_al_visitar_una_ruta_protegida`
   se renombró a
   `usuario_sin_sesion_ve_la_pagina_de_inicio_y_puede_ir_a_login` — visita
   el harness sin sesión, confirma titular/CTA visibles y ausencia de
   contenido protegido, hace clic en el CTA, y confirma (con el mismo
   `page.route` que ya usaba este archivo) que la navegación resultante va
   a `/auth/login`. `e2e/authHarness/main.tsx` también se ajustó: monta
   `ProtectedRoute anonymousView={<HomePage />}` (el `HomePage` real, no un
   stub — aquí sí importa ejercer la integración real en un navegador) y se
   quitó el `<LoginButton />` suelto que se montaba fuera de
   `ProtectedRoute` (ningún test lo ejercía; el CTA de `HomePage` cubre ese
   caso).

## Un cuarto ajuste descubierto durante la verificación (no en la lista original)

`e2e/logout.spec.ts` fallaba tras el cambio: `LogoutButton` navega a `/`
tras cerrar sesión (sin cambios), y el test verificaba "termina mostrando
el estado anónimo" comprobando que el navegador *seguía* navegando de `/` a
`/auth/login` — eso dependía del auto-redirect que esta feature elimina a
propósito. Se trata de la misma categoría de ajuste que los tres anteriores
(consecuencia directa y necesaria del cambio de `ProtectedRoute`, no scope
creep sobre la feature `logout_button`: su comportamiento real no cambió).
Se ajustó el test para verificar que, tras el clic en "Cerrar sesión", la
navegación termina en `/` mostrando `HomePage` (titular + CTA) — documentado
con un comentario en el propio archivo. Sin este ajuste, `./init.sh` no
quedaba en verde.

## Tests nuevos

- `tests/features/home/HomePage.test.tsx`: titular/lede/CTA presentes,
  las 3 líneas de capacidad presentes, panel "Escaneo en vivo" con sus
  líneas visibles simulando `prefers-reduced-motion` (mock estándar de
  `window.matchMedia`) — jsdom no ejecuta animaciones CSS, así que esto
  confirma que el contenido nunca depende de JS/animación para estar en el
  DOM.
- `tests/auth/LoginButton.test.tsx`: un test nuevo cubre el override de
  `label`/`className` sin duplicar la cobertura de navegación existente.
- `e2e/home.spec.ts`: visita `/` sin sesión (servidor de contrato real vía
  `webServer`), ve titular/panel/capacidades, hace clic en "Iniciar
  sesión", confirma navegación a `/auth/login` (interceptada con
  `page.route`, mismo patrón que el resto del repo), y falla si aparece
  algún mensaje de consola con "Content Security Policy" (cobertura
  automatizada adicional a la verificación manual con la imagen Docker
  real, documentada arriba, que es la que de verdad ejercita la CSP de
  producción).

## Verificación final (orden pedido)

Todo en verde, ejecutado varias veces durante la sesión, última pasada
completa:

```
npm run typecheck    -> OK, sin errores
npm run lint         -> OK, sin warnings
npm run format:check -> OK, sin diferencias
npm run test         -> OK, 128 tests (28 archivos)
npm run build        -> OK (bundle CSS 9.01 kB, JS 243.95 kB gzip 74.68 kB,
                         10 archivos de fuente latin-only)
npm run test:e2e     -> OK, 14/14 specs (13 previos + e2e/home.spec.ts),
                         incluye el logout.spec.ts ajustado
./init.sh            -> [OK] Entorno listo
```

Verificación manual adicional de CSP: `docker build` +
`docker run` de la imagen real de `containerization` (feature 8), visitada
con Chromium vía Playwright — 0 mensajes de consola con "Content Security
Policy"; `curl -I` confirma el header `font-src 'self'` en la respuesta
real de nginx.

## Archivos relevantes

- `src/auth/ProtectedRoute.tsx`, `src/auth/LoginButton.tsx`, `src/App.tsx`
- `src/features/home/HomePage.tsx`, `src/features/home/home.css`,
  `src/features/home/index.ts`
- `tests/auth/ProtectedRoute.test.tsx`, `tests/auth/LoginButton.test.tsx`,
  `tests/App.test.tsx`, `tests/features/home/HomePage.test.tsx`
- `e2e/auth-session.spec.ts`, `e2e/authHarness/main.tsx`,
  `e2e/logout.spec.ts`, `e2e/home.spec.ts`
- `package.json` / `package-lock.json` (nuevas dependencias
  `@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono`, versión
  `5.3.0` exacta)

No se tocó `feature_list.json` (status de la feature 12 permanece
`in_progress`) ni `src/index.css`.
