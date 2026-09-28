# Informe de implementación — feature 9 (`network_credentials_manager`)

## Qué se implementó

Gestión de credenciales de red (formulario + listado con borrado), única
pieza de UI que faltaba para que el flujo login → configurar credenciales →
enviar escaneo pueda completarse: sin al menos una entrada configurada,
`POST /api/scans` siempre responde `422` en el Gateway real. El Gateway ya
expone `GET`/`POST /api/network-credentials` y
`DELETE /api/network-credentials/:id` (feature `network_credentials_proxy`,
`done`, repo hermano `gateway`) — se leyó `gateway/src/api.rs` y
`gateway/src/usuarios_client.rs` (solo lectura) como fuente de verdad del
contrato exacto.

Archivos nuevos/modificados:

- `src/api/httpClient.ts` — `PerformRequestInit.method` acepta también
  `"DELETE"` (antes solo `"GET"|"POST"`).
- `src/api/types.ts` — `NetworkCredential` (sin `ssh_credentials_ref`,
  coincide campo a campo con `gateway/src/usuarios_client.rs::NetworkCredential`)
  y `CreateNetworkCredentialInput` (sí la incluye, es el cuerpo del `POST`).
- `src/api/guards.ts` — `isNetworkCredential`/`isNetworkCredentialArray`,
  mismo patrón que `isScanHistoryEntryArray`.
- `src/api/networkCredentials.ts` (nuevo) — `createNetworkCredential`,
  `listNetworkCredentials`, `deleteNetworkCredential`, mismo estilo que
  `scans.ts` (cada función tipa sus errores, nunca lanza un string suelto).
  `DELETE` exitoso es `204` sin cuerpo; `404` (nunca `403`) para un `id`
  ajeno o inexistente, igual que documenta `gateway/src/api.rs`.
- `src/api/index.ts` — exporta lo anterior.
- `src/features/credentials/NetworkCredentialForm.tsx` (nuevo) — formulario
  controlado (`target_pattern`, `network_user`, `ssh_credentials_ref` como
  `type="password"`, checkbox `has_sudo`), mismo patrón de estado que
  `ScanForm.tsx` (unión discriminada idle/submitting/success/error,
  `describeCreateError` mapeando `ApiError`). Limpia el formulario tras un
  submit exitoso y notifica hacia arriba vía `onCreated`.
- `src/features/credentials/NetworkCredentialsListView.tsx` (nuevo) —
  presentacional puro, mismo criterio que `HistoryTableView.tsx`: recibe
  `entries`/`rowStates`/`onDelete` como props, no importa runtime de
  `src/api`. Renderiza `target_pattern`/`network_user`/`has_sudo` por fila
  — nunca `ssh_credentials_ref` (el tipo `NetworkCredential` ni lo tiene).
- `src/features/credentials/NetworkCredentialsManager.tsx` (nuevo) —
  contenedor: fetch inicial vía `listNetworkCredentials()` (mismo patrón
  `useEffect` + bandera `active` que `HistoryTable.tsx`), maneja el borrado
  por fila (`deleteNetworkCredential`) y refetch simple del listado tras
  crear o borrar con éxito. Compone `NetworkCredentialForm` +
  `NetworkCredentialsListView`.
- `src/features/credentials/index.ts` (nuevo) — barrel de la feature.
- `src/features/index.ts` — comentario de cabecera actualizado.
- `src/App.tsx` — se monta `<NetworkCredentialsManager />` dentro del mismo
  `ProtectedRoute`, **antes** de `<ScanForm />` (hay que poder configurar
  una credencial antes de poder escanear con éxito). Sin routing nuevo.
- `e2e/contract-server/store.ts` — `NetworkCredentialRecord`,
  `createNetworkCredential`/`listNetworkCredentials`/
  `findOwnedNetworkCredential`/`deleteNetworkCredential`/
  `toNetworkCredential` (nunca serializa `sshCredentialsRef`).
- `e2e/contract-server/server.ts` — 3 endpoints nuevos
  (`GET`/`POST /api/network-credentials`,
  `DELETE /api/network-credentials/:id`), mismo criterio de
  autenticación/ownership/404 que ya usan scans.

## Decisiones tomadas

1. **`validateScanTarget` reutilizado como hint de UX no bloqueante**, no
   como validador que deshabilite el envío. El propio `acceptance` de la
   feature permite explícitamente esta opción ("puede quedar como mejora de
   UX no bloqueante si no cubre IPv6"): `target_pattern` acepta IPv4 o IPv6
   en el contrato real (`gateway/src/usuarios_client.rs`), pero
   `validateScanTarget` (feature `scan_request_form`) solo reconoce IPv4.
   Bloquear el envío según ese validador rechazaría un CIDR IPv6 válido que
   el Gateway/`ms-usuarios` sí aceptarían. Decisión documentada en el
   comentario de cabecera de `NetworkCredentialForm.tsx`; `canSubmit` solo
   exige que los campos no estén vacíos.
2. **Contenedor único (`NetworkCredentialsManager`) en vez de levantar el
   estado hasta `App.tsx`**, a diferencia de `selectedScanId` (feature
   `report_view`). Motivo: el criterio de aceptación pide "montar el nuevo
   componente" (singular) en `App.tsx`, y el formulario + listado + su
   sincronización (refetch tras crear/borrar) son detalles internos de esta
   única feature, sin necesidad de que `App.tsx` los conozca — mismo
   principio de encapsulamiento que ya usa `HistoryTable` para su propio
   fetch/cancelar.
3. **Refetch simple tras crear/borrar**, no inserción/eliminación manual del
   array local — mismo criterio ya documentado en `HistoryTable.tsx` tras
   cancelar: una única fuente de verdad (la respuesta de
   `listNetworkCredentials`).
4. **`ssh_credentials_ref` nunca sale del ciclo de vida del formulario**:
   input `type="password"`, se limpia tras éxito, nunca se loggea, nunca se
   pasa a `onCreated` (que solo recibe la `NetworkCredential` devuelta, tipo
   sin ese campo — imposible en tiempo de compilación que lo tenga).

## Tests añadidos

- `tests/api/networkCredentials.test.ts` — las tres funciones contra el
  servidor de contrato real (nunca `vi.mock`): éxito de `create` sin
  `ssh_credentials_ref` en la respuesta, `400`→`validation`,
  `401`→`unauthorized`; `list` filtra por sesión (dos sesiones distintas no
  se mezclan); `delete` exitoso y `404`→`not_found` para un id inexistente.
- `tests/api/guards.test.ts` — casos añadidos para
  `isNetworkCredential`/`isNetworkCredentialArray` (shape válido, shape
  incompleto, `has_sudo` no booleano).
- `tests/features/credentials/NetworkCredentialForm.test.tsx` — envío
  deshabilitado mientras falten campos requeridos; submit exitoso llama a
  `onCreated` con la credencial devuelta (nunca con `ssh_credentials_ref`) y
  limpia el formulario; el campo de credencial SSH es `type="password"`;
  submit fallido (401 sin sesión) muestra el error explícito.
- `tests/features/credentials/NetworkCredentialsListView.test.tsx` —
  presentacional puro (props fabricadas, sin red): muestra
  `target_pattern`/`network_user`/`has_sudo` por fila; nunca renderiza
  `ssh_credentials_ref`; dispara `onDelete` con el `id` correcto; deshabilita
  el botón mientras la fila está borrando; muestra el error de borrado sin
  quitar la fila; estado vacío explícito sin entradas.
- `tests/features/credentials/NetworkCredentialsManager.test.tsx` —
  contenedor real, contra el servidor de contrato real: lista al montar;
  crear una credencial refresca el listado sin recargar la página; borrar
  una credencial la quita del listado.
- `e2e/network-credentials.spec.ts` — flujo completo contra `App.tsx` real:
  crear una credencial, verla en el listado (objetivo/usuario/sudo),
  confirmar que la credencial SSH real nunca aparece en el DOM, borrarla y
  confirmar que desaparece (vuelve el estado vacío).

## Resultado de cada verificación

Ejecutadas en este orden, todas en verde:

1. `npm run typecheck` → OK, sin errores de tipos.
2. `npm run lint` → OK, sin warnings.
3. `npm run format:check` → OK tras `prettier --write` sobre los 5 archivos
   nuevos que lo necesitaban.
4. `npm run test` → **117/117 tests pasan** (26 archivos), incluidos los
   tests nuevos de esta feature.
5. `npm run build` → OK, build de producción sin errores.
6. `npm run test:e2e` → **12/12 specs pasan**: los 11 previos siguen verdes,
   más el nuevo `e2e/network-credentials.spec.ts`.
7. `./init.sh` → `[OK] Entorno listo. Puedes empezar a trabajar.` (las 5
   secciones del script en verde).

## Alcance respetado

- No se tocó `package.json` (sin dependencias nuevas), `vite.config.ts`,
  `playwright.config.ts`.
- No se introdujo `react-router` ni ninguna librería de routing nueva.
- No se tocó `gateway/`, `docker-compose.yml` de la raíz, ni `deploy/aws/`.
- `ssh_credentials_ref` nunca se persiste en `localStorage`/`sessionStorage`,
  nunca se loggea, y no aparece en el bundle de producción salvo como el
  nombre del campo necesario para construir el cuerpo del `POST` saliente
  (verificado con `grep` sobre `dist/assets/*.js`).

## Estado

`feature_list.json` queda con la feature 9 en `"status": "in_progress"`
hasta que el `reviewer` emita su veredicto (protocolo de
`.claude/agents/implementer.md`).
