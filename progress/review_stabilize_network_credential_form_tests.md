# Review — feature 15 (stabilize_network_credential_form_tests)

**Veredicto:** APPROVED

## Verificación independiente (no me baso solo en el informe del implementer)

- `git branch --show-current` → `feature/stabilize_network_credential_form_tests`
  (no `feature/logout`). Cumple acceptance #4.
- `git diff --stat` (archivos trackeados modificados): solo
  `tests/features/credentials/NetworkCredentialForm.test.tsx`,
  `feature_list.json` (solo `status: pending → in_progress`) y
  `progress/current.md`. **Nada en `src/`.** Cumple acceptance #2.
- Diff completo de `NetworkCredentialForm.test.tsx` revisado línea por línea:
  en los dos tests (`deshabilita_el_envio_mientras_falten_campos_requeridos`
  y `submit_exitoso_llama_a_onCreated_con_la_credencial_devuelta_y_limpia_el_formulario`)
  solo se añade `const user = userEvent.setup({ delay: null });` y se
  reemplaza el receptor estático `userEvent.type(...)`/`userEvent.click(...)`
  por la instancia `user.type(...)`/`user.click(...)`. Mismas aserciones,
  mismo orden, mismos valores (`192.168.1.10`, `root`,
  `vault://ssh/lab-key`), mismo `toMatchObject`/`not.toHaveProperty`. No se
  tocó la semántica del test. Los otros dos tests del archivo
  (`el_campo_de_credencial_ssh_es_de_tipo_password`,
  `submit_fallido_muestra_el_error_explicito`) quedaron intactos. Cumple
  acceptance #1 y #2.
- `npm run typecheck` → sin errores.
- `npm run lint` → sin warnings.
- `npm run format:check` → sin diferencias.
- `npm test` (suite completa) ejecutado **yo mismo** 5 veces consecutivas:
  las 5 corridas dieron `Test Files 29 passed (29)` / `Tests 131 passed (131)`.
  `NetworkCredentialForm.test.tsx` en verde en las 5.
- `./init.sh` completo:
  - 1.ª corrida (inmediatamente después de las 5 corridas de `npm test`
    anteriores, es decir, la 6.ª invocación pesada seguida en la misma
    máquina): falló por un **timeout de pool de vitest en
    `isCancellableEntry.test.ts` y `ProtectedRoute.test.tsx`** — dos
    archivos completamente fuera del alcance de esta feature y distintos
    incluso de los dos que el implementer ya había documentado
    (`ScanForm.test.tsx`/`HomePage.test.tsx`). `NetworkCredentialForm.test.tsx`
    no fue uno de los archivos que falló.
  - 2.ª corrida (tras una pausa breve, sin más carga artificial encima):
    completamente verde — `format:check`, `lint`, `typecheck`, `test`
    131/131, `build`, `test:e2e` 14/14, exit code `0`.
  - Interpretación: la corrida fallida fue autoinfligida por mí (6 pasadas
    completas de la suite consecutivas en la misma máquina), no un defecto
    introducido por el diff revisado. Esto además **corrobora** el
    diagnóstico del implementer: el patrón de timeout por `userEvent.type`
    sin `delay: null` bajo carga de máquina es real y no está limitado a
    los dos archivos que él reportó — hoy también lo disparé en otros dos
    archivos distintos. Ver "Cambios requeridos" más abajo para que esto
    no se pierda.

## Checkpoints (`CHECKPOINTS.md`)

- C1 (arnés completo): [x] — 4 archivos base + 4 docs + `CHECKPOINTS.md`
  existen; `./init.sh` terminó con exit code 0 en la corrida sin carga previa.
- C2 (estado coherente): [x] — una sola feature `in_progress` (id 15,
  verificado con `jq`); `progress/current.md` refleja la sesión activa sin
  basura de sesiones previas; no se marcó `done` prematuramente.
- C3 (arquitectura): [x] — `src/` no se tocó; no hay dependencias nuevas
  (`package.json`/`package-lock.json` sin diff); no hay `console.log`,
  `any` ni `@ts-ignore` nuevos; `typecheck`/`lint` sin errores/warnings.
- C4 (verificación real): [x] — tests de componente existentes se
  mantienen; `e2e/` sigue en 14/14 contra el servidor de contrato real;
  `npm run test` 131/131 en verde (comprobado 7 veces en total entre mis
  corridas); `npm run build` genera sin errores.
- C5 (cierre de sesión): [ ]  ← Razón: `progress/history.md` todavía no
  tiene una entrada para esta sesión/feature 15 — pero la sesión sigue
  abierta (la propia feature queda intencionalmente `in_progress` hasta
  este veredicto, tal como indica `progress/current.md`), así que esto es
  responsabilidad del `leader` al cerrar la sesión, no un defecto del
  trabajo del implementer. No bloquea la aprobación de esta feature.

## Sobre el hallazgo fuera de alcance

El informe documenta (no corrige) un timeout intermitente con el mismo
patrón de causa raíz en `ScanForm.test.tsx` y `HomePage.test.tsx`, archivos
de otras features ya `done`. Confirmado con `git diff --stat` que esos
archivos no fueron tocados — es un hallazgo documentado honestamente, no un
intento de ocultar el problema. Además, en mi propia verificación disparé
el mismo patrón en dos archivos adicionales (`isCancellableEntry.test.ts`,
`ProtectedRoute.test.tsx`) bajo carga de máquina, lo que confirma que el
alcance real del problema es más amplio que lo ya documentado.

## Cambios requeridos (si aplica)

Ninguno para cerrar esta feature — el diff revisado cumple las 4
condiciones de `acceptance` de la feature 15 y no introduce regresiones.

Recomendación para una feature futura (no bloquea esta): abrir una feature
separada para aplicar `userEvent.setup({ delay: null })` de forma
sistemática en toda la suite (no solo `ScanForm.test.tsx`/`HomePage.test.tsx`,
sino también al menos `isCancellableEntry.test.ts` y `ProtectedRoute.test.tsx`,
que hoy mismo mostraron el mismo timeout bajo carga), dado que el patrón de
causa raíz ya está confirmado en más archivos de los que se había detectado
originalmente.
