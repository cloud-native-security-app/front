# Review — feature 9 (network_credentials_manager)

**Veredicto:** APPROVED

## Verificación independiente ejecutada

Todas en verde, en el orden que corre `./init.sh`:

1. `prettier --check .` → sin diferencias.
2. `eslint .` → sin warnings.
3. `tsc --noEmit` → sin errores de tipos.
4. `vitest run --run` → 117/117 tests (26 archivos), incluidos los nuevos de
   esta feature (`tests/api/networkCredentials.test.ts`,
   `tests/api/guards.test.ts` extendido,
   `tests/features/credentials/{NetworkCredentialForm,NetworkCredentialsListView,NetworkCredentialsManager}.test.tsx`).
5. `vite build` → build de producción sin errores (`dist/assets/index-WZI_Ph-M.js`).
6. `playwright test` → 12/12 specs, incluido el nuevo
   `e2e/network-credentials.spec.ts:19` (`crear_una_credencial_verla_en_el_listado_y_borrarla`).
7. `./init.sh` → `[OK] Entorno listo. Puedes empezar a trabajar.` (las 5
   secciones en verde, exit code 0 confirmado).
8. `git status --porcelain -uall` (excluyendo `dist/`/`node_modules/`,
   ambos en `.gitignore`) → coincide exactamente con la lista de archivos
   nuevos/modificados que reporta `progress/current.md` para esta feature,
   sin archivos sospechosos (`*.tmp` u otros).

## Contrato del Gateway (verificación cruzada, solo lectura)

Se leyó `../gateway/src/usuarios_client.rs` y las rutas de
`../gateway/src/api.rs` (`list_network_credentials`,
`create_network_credential`, `delete_network_credential`) como fuente de
verdad del contrato real que expone el Gateway:

- `NetworkCredential` (Rust, `usuarios_client.rs:198-213`) tiene exactamente
  `id`/`user_id`/`target_pattern`/`network_user`/`has_sudo`/`created_at`/
  `updated_at`, **sin** `ssh_credentials_ref` — coincide campo a campo con
  `src/api/types.ts:92-100`.
- `CreateNetworkCredentialRequest` (Rust) sí incluye `ssh_credentials_ref` —
  coincide con `CreateNetworkCredentialInput` (`src/api/types.ts:110-115`).
- `POST /api/network-credentials` responde `200` (no `201`) con el
  `NetworkCredential` creado (`api.rs:528`) — `networkCredentials.ts:37`
  verifica `result.status !== 200`, correcto.
- `DELETE /api/network-credentials/:id` responde `204` en éxito y `404`
  (nunca `403`) si el `id` es ajeno o inexistente (`api.rs:560-563`,
  `usuarios_client.rs:597-609`, comentario explícito "nunca 403, mismo
  criterio que user-service") — `networkCredentials.ts:93` verifica
  `result.status === 204` y delega el resto a `mapCommonErrorStatus`, que
  mapea `404` a `not_found`. Coincide.
- El servidor de contrato local (`e2e/contract-server/server.ts:274-324`,
  `store.ts:279-291`) reproduce el mismo contrato: `POST` devuelve `200`,
  `DELETE` devuelve `204`/`404` (nunca `403`), y `toNetworkCredential`
  (`store.ts:222-234`) nunca serializa `sshCredentialsRef`.

## Fuga de credenciales (`ssh_credentials_ref`)

- **`localStorage`/`sessionStorage`**: `grep -rn "localStorage\|sessionStorage" src/ tests/ e2e/` → sin resultados en todo el repo.
- **Consola**: `grep -rn "console\." src/features/credentials src/api/networkCredentials.ts src/api/httpClient.ts e2e/contract-server` → solo hay `console.error`/`console.log` en `e2e/contract-server/main.ts` y `server.ts:510`, infraestructura de test explícitamente permitida por `docs/conventions.md` (nunca llega a producción). Cero apariciones en el código de `src/features/credentials` o `src/api/networkCredentials.ts`.
- **Bundle de producción**: `grep -o "ssh_credentials_ref" dist/assets/*.js` → una sola aparición, dentro de la construcción del objeto que arma el `POST` (`{target_pattern:t.trim(),network_user:r.trim(),ssh_credentials_ref:a,has_sudo:s}`, minificado desde `NetworkCredentialForm.tsx:81-86`). Es el **nombre del campo** necesario para construir el cuerpo JSON de la petición saliente, no un valor de credencial embebido ni un literal de prueba filtrado — inevitable para cualquier cliente que necesite enviar ese campo al Gateway. No hay ningún valor de credencial (`vault://...` u otro) en el bundle.
- **Formulario**: `credential-ssh-ref` es `type="password"` (`NetworkCredentialForm.tsx:141`), se limpia tras un submit exitoso (`setSshCredentialsRef("")`), y nunca se pasa a `onCreated` (que solo recibe `result.value`, tipado `NetworkCredential`, sin ese campo — imposible que lo tenga en tiempo de compilación).
- **Tipos**: `NetworkCredential` no tiene el campo `ssh_credentials_ref` (verificado en `src/api/types.ts:92-100`), así que ningún componente que reciba ese tipo puede renderizarlo aunque quisiera — el guard `isNetworkCredential` tampoco lo exige ni lo preserva.
- **E2E real**: `e2e/network-credentials.spec.ts:39-43` verifica explícitamente que la credencial SSH real (`vault://ssh/e2e-lab-key`) **nunca** aparece en el DOM tras crear la entrada, contra la app real montada (`webServer` de Playwright), no un mock.

## Arquitectura y convenciones

- **Capas**: `src/api/networkCredentials.ts` es el único módulo nuevo que
  hace `fetch` (vía `performRequest`), mismo patrón que `scans.ts`; los
  componentes de `src/features/credentials` no importan `httpClient`
  directamente. `NetworkCredentialsListView.tsx` es puro/presentacional
  (solo `import type { NetworkCredential } from "../../api"`, sin runtime
  de `src/api`), mismo criterio que `HistoryTableView` — confirmado por
  lectura directa, sin `vi.mock` en su test.
- **Sin routing nuevo**: `App.tsx` monta `NetworkCredentialsManager` dentro
  del mismo `ProtectedRoute` ya existente, antes de `ScanForm`, sin tocar
  `main.tsx` ni añadir una librería de routing.
- **Sin dependencias nuevas**: `package.json` no aparece en el diff
  (`git diff --stat` no lo lista); `dependencies`/`devDependencies` son
  exactamente las mismas que antes de esta feature.
- **Nombres/estilo**: componentes en `PascalCase` con archivo homónimo,
  funciones en `camelCase`, unión discriminada `idle/submitting/success/error`
  para el formulario y `loading/error/loaded` para el listado, mismo
  criterio que `ScanForm`/`HistoryTable`. Tests con nombres descriptivos en
  snake_case español, consistente con el resto del repo.
- **JSDoc de API pública**: las tres funciones de `networkCredentials.ts`
  documentan qué hacen y con qué pueden fallar, mismo formato que `scans.ts`.
- **`any`/`@ts-ignore`**: `grep -rn "@ts-ignore\|: any\b"` sobre
  `src/features/credentials`, `src/api/networkCredentials.ts`,
  `src/api/guards.ts`, `src/api/types.ts` → sin resultados.
- **`validateScanTarget` reutilizado como hint no bloqueante**: la decisión
  de no escribir un segundo validador IPv6 está documentada en el
  encabezado de `NetworkCredentialForm.tsx:14-21` y es exactamente lo que
  el `acceptance` de la feature permite explícitamente ("puede quedar como
  mejora de UX no bloqueante si no cubre IPv6"). `canSubmit` no depende de
  `targetHint.valid`, solo de que el campo no esté vacío — confirmado en
  `NetworkCredentialForm.tsx:69-73`, así que un CIDR IPv6 válido no queda
  bloqueado por el cliente.

## Checkpoints (`CHECKPOINTS.md`)

- **C1 — arnés completo**: [x] Existen los 4 archivos base y los 4 docs;
  `./init.sh` terminó con exit code 0 (confirmado explícitamente, no solo
  por el resumen `[OK]`).
- **C2 — estado coherente**: [x] Solo la feature 9 está `in_progress` en
  `feature_list.json` (1-8 `done`); las features `done` tienen tests que
  siguen pasando (117/117, ninguna regresión); `progress/current.md`
  describe la sesión activa de `network_credentials_manager` sin basura de
  sesiones previas.
- **C3 — arquitectura respetada**: [x] `src/` solo contiene `api`, `auth`,
  `features`, `components`, `routes` (más `App.tsx`/`main.tsx`/
  `vite-env.d.ts` en la raíz, ya presentes desde `scaffolding`); sin
  dependencia nueva en `package.json`; sin `console.log` de depuración,
  `any`/`@ts-ignore` sin justificar en el código de esta feature;
  `typecheck`/`lint` sin errores/warnings.
- **C4 — verificación real**: [x] `tests/api/networkCredentials.test.ts`
  cubre la lógica de red (contra el servidor de contrato real, sin
  `vi.mock`/`msw`); `tests/features/credentials/` cubre tanto el
  formulario como el listado (presentacional en aislamiento, contenedor
  contra el servidor de contrato real); `e2e/network-credentials.spec.ts`
  cubre el flujo de usuario completo (crear → ver en listado → borrar) de
  punta a punta, incluida la verificación explícita de que la credencial
  SSH nunca aparece en el DOM. `npm run test`/`npm run build` verdes.
- **C5 — cierre de sesión**: [ ] No evaluado como bloqueante para este
  veredicto (mismo criterio que `review_scan_history.md`):
  `progress/history.md` todavía no tiene la entrada de esta sesión, ni
  `feature_list.json` fue marcada `done` — eso corresponde al `leader` al
  cerrar la sesión tras este approve. No hay archivos sin trackear
  sospechosos (`git status --porcelain -uall` solo muestra los archivos
  nuevos esperados de esta feature, `dist/`/`node_modules/` correctamente
  ignorados por `.gitignore`).

## Acceptance de `feature_list.json` (id 9) — verificado bullet a bullet

1. `httpClient.ts`: `PerformRequestInit.method` acepta `"DELETE"` —
   `httpClient.ts:26`. ✔
2. `networkCredentials.ts` nuevo, mismo estilo que `scans.ts`, tres
   funciones con las rutas y verbos exactos, tipos de respuesta sin
   `ssh_credentials_ref` (confirmado contra el contrato real del Gateway
   arriba). ✔
3. Guards `isNetworkCredential`/`isNetworkCredentialArray` en
   `guards.ts:80-99`, mismo patrón que `isScanHistoryEntryArray`. ✔
4. Formulario controlado con los 4 campos pedidos, `ssh_credentials_ref`
   como `type="password"`, mismo patrón de estado que `ScanForm`,
   decisión documentada sobre `validateScanTarget`. ✔
5. Listado con la estructura de `HistoryTable` (tabla, una fila por
   entrada), muestra `target_pattern`/`network_user`/`has_sudo`, nunca
   `ssh_credentials_ref` (ni el tipo lo tiene), botón de borrar por fila
   que llama `deleteNetworkCredential` y refresca (`refresh()` tras éxito
   en `NetworkCredentialsManager.tsx:104-106`). ✔
6. `App.tsx` monta `NetworkCredentialsManager` dentro de `ProtectedRoute`,
   antes de `ScanForm` (`App.tsx:50-51`). ✔
7. `e2e/contract-server/` extendido con los 3 endpoints, mismo criterio de
   ownership/404 que scans/history. ✔
8. Tests de componente para formulario y listado (y también para el
   contenedor, extra no pedido explícitamente pero coherente). ✔
9. `e2e/network-credentials.spec.ts`: crear → ver en listado → borrar →
   confirmar que desaparece, más la verificación de no-fuga de la
   credencial SSH. ✔
10. `./init.sh` en verde. ✔

## Conclusión

Los 10 bullets del `acceptance` de la feature 9 se verifican correctos
contra el código real (no solo el informe del implementer). El contrato
con el Gateway real (`gateway/src/usuarios_client.rs`, `gateway/src/api.rs`,
solo lectura) coincide campo a campo y código de estado a código de
estado, incluyendo el detalle fino de que `DELETE` responde `404` — nunca
`403` — para una entrada ajena o inexistente, tanto en `src/api/
networkCredentials.ts` como en el servidor de contrato local. No se
encontró ninguna fuga de `ssh_credentials_ref` (ni el valor real ni una
ruta de persistencia) en `localStorage`/`sessionStorage`, consola, o el
bundle de producción — la única aparición del string en `dist/` es el
nombre del campo dentro de la construcción del cuerpo de la petición
saliente, inevitable e inofensivo. Arquitectura (capas, sin routing nuevo,
sin dependencias nuevas) y convenciones (nombres, JSDoc, sin `any`/
`@ts-ignore`) se respetan. Todas las verificaciones (`prettier`, `eslint`,
`tsc`, `vitest`, `vite build`, `playwright`, `./init.sh`) están en verde,
ejecutadas de forma independiente por este reviewer.

Sin cambios requeridos.
