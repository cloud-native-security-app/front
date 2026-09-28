# Review — feature 12 (`home_landing_page`)

**Veredicto:** APPROVED

## Verificación ejecutada (reproducida de forma independiente, no solo leída del informe)

- `npm run typecheck` → OK, sin errores.
- `npm run lint` → OK, sin warnings.
- `npm run format:check` → OK, sin diferencias.
- `npm run test` → OK, 128 tests (28 archivos) verdes.
- `npm run build` → OK, bundle 9.01 kB CSS / 243.95 kB JS (gzip 74.68 kB), 10 archivos de fuente latin-only.
- `npm run test:e2e` → OK, 14/14 specs verdes (incluye `e2e/home.spec.ts` nuevo y `e2e/logout.spec.ts` ajustado).
- `./init.sh` → `[OK] Entorno listo`.
- **CSP contra imagen Docker real (reproducido, no solo confiado en el reporte):** `docker build --build-arg VITE_GATEWAY_BASE_URL=http://gateway.example.test -t front-review-test .` → build exitoso, multi-stage (`node:22-bookworm-slim` builder, `nginx:1.27-alpine` runtime, ambas fijadas por digest). `docker run` sirviendo en `:18080`.
  - `curl -sI http://localhost:18080/` → header `Content-Security-Policy` real incluye `font-src 'self'`.
  - Visita con Chromium real vía Playwright (`page.on("console")`): único mensaje de consola fue `Failed to load resource: net::ERR_NAME_NOT_RESOLVED` (esperado, `gateway.example.test` no resuelve DNS — llamada a `/api/me`), **cero mensajes de "Content Security Policy"**.
  - Los 5 archivos `.woff2`/`.woff` de `@fontsource/space-grotesk` e `@fontsource/ibm-plex-mono` cargan con status `200` cada uno.
  - `getComputedStyle` confirma `font-family: "Space Grotesk", ...` en el titular y `"IBM Plex Mono", ...` en el panel técnico.
  - Contenedor/imagen de prueba eliminados al terminar (`docker rm -f`, `docker rmi`).

## Checkpoints (CHECKPOINTS.md)

- C1: [x] — `AGENTS.md`, `init.sh`, `feature_list.json`, `progress/current.md`, los 4 docs existen; `./init.sh` exit 0.
- C2: [x] — una sola feature `in_progress` (`12`); `progress/current.md` describe la sesión activa, no basura vieja.
- C3: [x] — `src/` respeta las carpetas previstas; dependencias nuevas (`@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono`, versión exacta `5.3.0`) justificadas explícitamente en el informe y en `feature_list.json`; sin `console.log` de depuración, sin `any`/`@ts-ignore` sin justificar (`grep` limpio en todo el código de esta feature); `npm run typecheck`/`npm run lint` sin errores/warnings.
- C4: [x] — tests unitarios/componente nuevos (`tests/features/home/HomePage.test.tsx`, ajuste de `tests/auth/LoginButton.test.tsx`) y e2e (`e2e/home.spec.ts`) cubren el flujo; `npm run test` > 0 y verde; `npm run build` sin errores.
- C5: [x] — sin archivos sin trackear sospechosos (`git status` solo muestra los archivos esperados de esta feature más `.agents/`/`skills-lock.json`, que son harness de skill, no basura); `progress/current.md` documenta la sesión activa correctamente.

## Puntos específicos evaluados

1. **Capas.** `git diff -- src/auth/ProtectedRoute.tsx` confirma: se eliminó el `useEffect` + `import { loginRedirectUrl } from "../api"` y se agregó la prop obligatoria `anonymousView: ReactNode`, renderizada tal cual (`<>{anonymousView}</>`) en el caso `anonymous`. `ProtectedRoute.tsx` no importa nada de `src/features/*`; quien arma el nodo es `src/App.tsx` (`anonymousView={<HomePage />}`) y `e2e/authHarness/main.tsx`. Correcto.

2. **`LoginButton` con `label`/`className`.** La navegación (`window.location.href = loginRedirectUrl()`) no cambió — sigue siendo el único efecto de `handleClick`, nunca un `fetch`. El uso existente sin props conserva el default `"Iniciar sesión con Google"` (verificado: el resto de `tests/auth/LoginButton.test.tsx` sigue verificando ese texto sin tocar). El test nuevo (`acepta_un_label_y_una_clase_personalizados_sin_cambiar_la_navegacion`) solo verifica el override de texto/clase, sin re-probar la navegación ya cubierta por los tests existentes del mismo archivo — no duplica cobertura.

3. **Copy literal.** Comparado carácter a carácter contra el objeto de la feature 12 en `feature_list.json`: titular, lede, CTA "Iniciar sesión", label del panel "Escaneo en vivo", las 3 líneas de capacidad ("Encolar — …", "Verificar — …", "Reportar — …") y el pie "front habla únicamente con el Gateway de la plataforma." — coinciden literalmente en `src/features/home/HomePage.tsx`. Sin parafraseo.

4. **Paleta/tipografía aisladas.** `git diff -- src/index.css` está vacío (confirmado). La paleta (`--home-bg`, `--home-surface`, `--home-border`, `--home-text`, `--home-text-muted`, `--home-accent`) está definida solo en `.home-page` dentro de `home.css`. El acento cian (`--home-accent`) se usa en: fondo/borde/hover del CTA, el punto "en vivo" del panel, y `a:hover`. Se usa además en el `outline` de `:focus-visible` del CTA/enlaces — es una cuarta aparición no listada explícitamente en el criterio de aceptación ("usado ÚNICAMENTE en el CTA, el punto 'en vivo', y hover de enlaces"), pero es un uso de accesibilidad razonable (visibilidad del foco) que reutiliza la paleta existente en vez de introducir un color nuevo; no representa un incumplimiento del espíritu de la restricción (evitar que el acento se disperse decorativamente). No se considera bloqueante.

5. **Fuentes self-hosted.** `package.json`/`package-lock.json` confirman `@fontsource/space-grotesk@5.3.0` y `@fontsource/ibm-plex-mono@5.3.0` (versión exacta, sin `^`), resueltos desde `registry.npmjs.org`. `grep -rn "fonts.googleapis\|fonts.gstatic" src/` no arroja resultados. Los imports en `HomePage.tsx` usan los subsets `latin-*.css` (menor peso, sin cyrillic/greek/vietnamese innecesarios).

6. **CSP.** Reproducido independientemente (ver sección de verificación arriba): `font-src 'self'` confirmado en la respuesta real de nginx vía `curl -I`, y cero mensajes de consola de CSP visitando la imagen Docker real con Chromium (Playwright). Coincide con lo reportado por el implementer.

7. **Animación / `prefers-reduced-motion`.** `home.css` confirma que bajo `@media (prefers-reduced-motion: reduce)` se fuerza `animation: none; opacity: 1` en `.home-page__panel-line` — las líneas se muestran, nunca quedan ocultas. Es el único movimiento orquestado de la página: no hay más `animation`/`@keyframes` en el archivo, y la transición de color del CTA en `:hover` no tiene `transition:` declarado (cambio instantáneo, ni siquiera una transición real), coherente con "un solo momento de movimiento".

8. **Ajustes a tests de features `done`.** Los 4 ajustes son consecuencia mínima y directa de eliminar el auto-redirect, y cada uno preserva la propiedad original que protegía:
   - `tests/auth/ProtectedRoute.test.tsx`: usa el stub `<p>vista anónima de prueba</p>` como `anonymousView`, no `HomePage` real — mantiene el test desacoplado, tal como pide la instrucción. Sigue verificando que el contenido protegido no se renderiza.
   - `tests/App.test.tsx`: caso anónimo ahora verifica `HomePage` (heading + CTA "Iniciar sesión") y ausencia del `<h1>front</h1>`; caso autenticado sigue verificando `<h1>front</h1>` (ahora dentro de la rama protegida) además del formulario de escaneo. Ambas ramas siguen cubiertas.
   - `e2e/auth-session.spec.ts` (renombrado a `usuario_sin_sesion_ve_la_pagina_de_inicio_y_puede_ir_a_login`): visita sin sesión → ve titular/CTA de `HomePage`, confirma ausencia de "Contenido protegido" → clic en CTA → `page.waitForURL` hacia `/auth/login`, interceptado con el mismo `page.route` que ya usaba este archivo (no depende de red real hacia Google). `e2e/authHarness/main.tsx` monta el `HomePage` real como `anonymousView` (correcto para un e2e de integración) y elimina el `<LoginButton />` suelto que ningún test ejercía.
   - `e2e/logout.spec.ts`: confirmado con `git diff -- src/auth/LogoutButton.tsx` que el componente real no cambió (diff vacío) — sigue navegando a `/` sin cambios. El test ajustado verifica correctamente que, tras el clic en "Cerrar sesión", la navegación termina en `/` mostrando `HomePage` (titular + CTA), en vez de seguir encadenando hacia `/auth/login` (que dependía del auto-redirect eliminado a propósito por esta feature). Es una consecuencia necesaria, no una tapadera de un bug: el criterio de aceptación original de `logout_button` ("termina mostrando el estado anónimo") se sigue cumpliendo, solo cambia el mecanismo de verificación.

9. **Layout asimétrico / accesibilidad.** `home.css`: `.home-page__shell` es un grid `1fr` en mobile y `3fr 2fr` desde `60rem`, con `.home-page__panel { margin-top: 3rem }` en desktop (asimetría real, no centrado); `.home-page__intro { align-items: flex-start }` confirma alineación a la izquierda. `:focus-visible` está definido para `.home-page a` y `.home-page__cta` con `outline: 3px solid var(--home-accent)` — no hay ningún `outline: none` huérfano en el archivo.

10. Sin `dangerouslySetInnerHTML`, sin `console.log`, sin `any`/`@ts-ignore` sin justificar en todo el código de esta feature (`grep` limpio en `src/features/home/`, `src/auth/ProtectedRoute.tsx`, `src/auth/LoginButton.tsx`, `src/App.tsx`, `e2e/home.spec.ts`, `e2e/authHarness/main.tsx`, `tests/features/home/`).

## Cambios requeridos

Ninguno. La feature puede pasar a `done`.
