# Implementación — feature 15: stabilize_network_credential_form_tests

## Rama

`feature/stabilize_network_credential_form_tests` (confirmado con
`git branch --show-current`; no se trabajó en `feature/logout`).

## Diagnóstico

Los dos tests intermitentes (`deshabilita_el_envio_mientras_falten_campos_requeridos`
y `submit_exitoso_llama_a_onCreated_con_la_credencial_devuelta_y_limpia_el_formulario`)
usaban `userEvent.type(...)` con la configuración por defecto de
`@testing-library/user-event`, que inserta un pequeño `delay` entre cada
pulsación de tecla simulada. Con tres campos de texto por test (IP, usuario,
credencial SSH) y la suite corriendo en paralelo (CPU compartida entre
workers de Vitest), ese delay acumulado podía superar el timeout de test de
Vitest (5 s por defecto), produciendo el fallo intermitente reportado.

## Opción elegida

**`userEvent.setup({ delay: null })`**, aplicada únicamente a los dos tests
afectados (no a los otros dos tests del archivo, que no tecleaban lo
suficiente como para haber mostrado el problema, para mantener el diff
mínimo).

### Por qué esta y no `user.paste`

- `delay: null` es un flag de una sola línea por test, sin tocar la lista de
  `await userEvent.type(...)` existente más que cambiar el receptor
  (`userEvent` estático → instancia `user` de `userEvent.setup(...)`):
  mínimo diff, cero cambio de intención del test.
- `user.paste` simula un pegado (un evento `paste` + cambio de valor de una
  sola vez) en lugar de tecleo letra por letra; cambia la semántica de lo
  que el test ejerce (deja de probar que el campo reacciona a cada
  `onChange` por tecla, aunque en este caso no se verifica eso
  explícitamente). `delay: null` conserva exactamente el mismo
  comportamiento verificado (sigue siendo tecleo letra por letra, con los
  mismos eventos de teclado, solo sin la espera artificial entre ellos) y
  es la opción recomendada por la propia documentación de
  `@testing-library/user-event` para este caso de timeouts en CI/paralelo.
- Un timeout explícito más alto (`it(..., { timeout: 15000 })`) fue
  descartado: solo oculta el síntoma (sigue siendo lento y sigue dependiendo
  de la velocidad de la máquina, solo que con más margen), no elimina la
  causa.

## Cambios

- `tests/features/credentials/NetworkCredentialForm.test.tsx`: en los dos
  tests mencionados, se agrega `const user = userEvent.setup({ delay: null });`
  al inicio y se reemplazan las llamadas `userEvent.type(...)`/`userEvent.click(...)`
  de ese test por `user.type(...)`/`user.click(...)`. Comentario breve en
  cada test explicando el motivo (por qué no obvio, ver
  `docs/conventions.md`). Nada más cambia: mismas aserciones, mismo orden,
  mismo comportamiento verificado.
- `src/` no se tocó (confirmado con `git diff --stat`).

## Hallazgo fuera de alcance (no corregido en esta sesión)

Durante las 5 corridas iniciales de `npm test` (suite completa, en
paralelo), una corrida falló por timeout en
`tests/features/scan/ScanForm.test.tsx` (test
`deshabilita_el_envio_y_muestra_el_error_inline_sin_llamar_a_submitScan_con_entrada_invalida`,
feature `scan_request_form`, id 4, `done`) y otra corrida tuvo un timeout de
pool en `tests/features/home/HomePage.test.tsx`. Mismo patrón de causa raíz
(`userEvent.type` sin `delay: null`) pero en archivos de **otras features ya
cerradas**, fuera del alcance explícito de esta feature (que solo autoriza
tocar `tests/features/credentials/NetworkCredentialForm.test.tsx`). No se
tocaron esos archivos. Se recomienda una feature separada para aplicar el
mismo fix de forma sistemática si se decide que vale la pena.

## Verificación

- `npm run typecheck` → OK, sin errores.
- `npm run lint` → OK, sin warnings.
- `npm run format:check` → OK, sin diferencias.
- `npm test` (suite completa, sin filtrar) — **5 corridas consecutivas en
  verde** (tras descartar las corridas previas que fallaron por los archivos
  fuera de alcance documentados arriba):
  - Corrida 1: `Test Files 29 passed (29)` / `Tests 131 passed (131)`
  - Corrida 2: `Test Files 29 passed (29)` / `Tests 131 passed (131)`
  - Corrida 3: `Test Files 29 passed (29)` / `Tests 131 passed (131)`
  - Corrida 4: `Test Files 29 passed (29)` / `Tests 131 passed (131)`
  - Corrida 5: `Test Files 29 passed (29)` / `Tests 131 passed (131)`
- `./init.sh` completo → verde (entorno, `format:check`, `lint`, `typecheck`,
  `test` 131/131, `build`, `test:e2e` 14/14).

## Estado

`feature_list.json`: id 15 queda en `"in_progress"` (no se marca `done`,
decisión del `reviewer`).
