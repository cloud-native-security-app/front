# Exploración — contrato real del Gateway (para `api_client`)

> Nota del leader: el subagente Explore que investigó esto no tenía
> herramienta de escritura de archivos, así que persisto aquí su reporte
> completo tal cual lo devolvió, para no perder la evidencia (regla
> anti-teléfono-descompuesto).

Repo explorado: `/home/o-aguirre/Documents/duoc/cloud-native/security-app/gateway`.
Las 11 features de `feature_list.json` del gateway están `"status": "done"`
con tests — el contrato descrito abajo está implementado, no es un plan a
futuro (con excepciones explícitas marcadas como "especulativas", ver
sección final).

## 0. Fuente de verdad

- **No hay OpenAPI/Swagger estático versionado en el repo** (ni
  `openapi.yaml`/`openapi.json` en disco), pero sí hay una especificación
  **generada en runtime** desde anotaciones `#[utoipa::path(...)]` en cada
  handler, servida en `GET /api/openapi.json` (pública, sin sesión).
  Fuente: `gateway/src/api.rs:966-1043` (`ApiDoc`, `openapi_router`,
  `openapi_json`). Hay un test anti-drift (`gateway/tests/openapi_docs.rs`)
  que falla si una ruta de `ROUTES` no tiene su anotación.
- La tabla canónica de rutas es `pub const ROUTES` en
  `gateway/src/api.rs:894-950`.
- `gateway/docs/architecture.md` es la fuente de verdad de decisiones de
  diseño.
- Recomendación: en vez de "inventar" el server de contrato, levantar el
  Gateway (`cargo run`) y volcar `GET /api/openapi.json`, o al menos
  replicar exactamente los shapes descritos abajo, tomados directamente del
  código Rust.

## 1. Endpoints HTTP

Todos bajo el mismo proceso/puerto (`gateway/src/api.rs:958-963`,
`app_router`).

### Auth / OIDC (públicas, sin cookie)
- `GET /auth/login` → `302 Found` con header `Location` al endpoint de
  autorización de Google (`gateway/src/api.rs:1045-1065`). Sin body.
- `GET /auth/callback?code=...&state=...` (`gateway/src/api.rs:1067-1132`):
  - `200 OK` sin body JSON — solo `Set-Cookie: gateway_session=<jwt>;
    HttpOnly; Secure; SameSite=Strict; Path=/`.
  - `400 Bad Request` (texto plano): falta `state`/`code`, o `state` no
    coincide con ningún login vigente.
  - `401 Unauthorized` (texto plano): ID token inválido/expirado/`aud`/
    `iss`/`nonce` incorrectos.
  - `500 Internal Server Error` (texto plano): fallo de discovery OIDC o
    al firmar la sesión propia.
- `POST /auth/logout` → `204 No Content` + `Set-Cookie` que borra
  `gateway_session` (`gateway/src/api.rs:1134-1145`). Funciona incluso sin
  sesión válida (fuera del middleware de sesión, deliberadamente).

### Sesión / perfil (protegidas — requieren cookie `gateway_session`)
- `GET /api/me` (`gateway/src/api.rs:410-426`): `200` con
  ```json
  { "sub": "string", "email": "string", "name": "string" }
  ```
  `401` si sesión ausente/inválida/expirada (mensaje genérico, texto
  plano). No llama a `ms-usuarios`.
- `GET /api/profile` (`gateway/src/api.rs:428-452`): proxea `GET /users/me`
  de `ms-usuarios`. `200` con **JSON opaco** (`UserProfile =
  serde_json::Value`, `gateway/src/usuarios_client.rs:78-81` — no está
  tipado campo a campo). `401` sin sesión. `502` si `ms-usuarios` respondió
  status inesperado. `504` si no se pudo contactar.

### Escaneos (protegidas)
- `POST /api/scans` (`gateway/src/api.rs:532-663`):
  - Request: `{ "target": "string" }` (IP o CIDR, sin validar en el tipo).
  - `200 OK` (no 201) con:
    ```json
    { "scanId": "uuid-v4-string" }
    ```
    (`#[serde(rename = "scanId")]`, `gateway/src/api.rs:543-547`).
  - `400`: `target` no es IP ni CIDR válido.
  - `401`: sesión inválida.
  - `422`: `ms-usuarios` no tiene credenciales de red configuradas.
  - `429` (texto): rate limit por usuario superado (RF-12,
    `gateway/src/api.rs:183-232`).
  - `501`: la API de `ms-usuarios` para resolver
    `network_user`/`ssh_credentials_ref`/`has_sudo` **todavía no existe**
    (dependencia pendiente, ver advertencias).
  - `502`: fallo al registrar histórico en `ms-usuarios` o publicar en el
    Broker.
  - `504`: no se pudo contactar `ms-usuarios`.
- `GET /api/scans` (`gateway/src/api.rs:454-530`, RF-13): `200` con array:
  ```json
  [
    {
      "scanId": "string (opcional, ausente si no hay mapeo en memoria)",
      "target": "string",
      "status": "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "FALLIDO",
      "requested_at": "RFC3339 string",
      "updated_at": "RFC3339 string"
    }
  ]
  ```
  Nótese: `scanId` va en camelCase pero `target`/`status`/`requested_at`/
  `updated_at` quedan en snake_case (inconsistencia de casing real,
  confirmar así al replicar el mock). `status` serializado
  `SCREAMING_SNAKE_CASE`: `PENDIENTE`/`EN_PROGRESO`/`COMPLETADO`/`FALLIDO`
  (`gateway/src/usuarios_client.rs:93-104`, test
  `scan_status_serializes_as_screaming_snake_case`). `401`/`502`/`504`
  igual que `/api/profile`.
- `POST /api/scans/{scan_id}/cancel` (`gateway/src/api.rs:789-869`,
  RF-14):
  - `202 Accepted` sin body.
  - `401`: sesión inválida.
  - `404` (texto): `scan_id` no existe o pertenece a otra sesión (mismo
    status para ambos, deliberado, para no filtrar existencia ajena).
  - `409` (texto): el escaneo ya está en estado terminal
    (`Completado`/`Fallido`).
  - `502`/`504`: fallo o timeout contra `ms-usuarios`/Broker.
- **Reporte de un escaneo (RF-11): NO existe ningún endpoint de reporte en
  este Gateway.** Documentado explícitamente como dependencia pendiente:
  `gateway/docs/architecture.md:102-110` — requiere `ms-analisis`, que
  "todavía no existe como repo". El resultado completo del escaneo
  (`ScanResult`: puertos + vulnerabilidades) solo se ve hoy vía el evento
  SSE `completed` (ver §2), no vía un endpoint HTTP separado. **No
  inventar un `GET /api/scans/{id}/report` — no existe todavía.**

### Otras
- `GET /health` (pública): `200 OK` sin body.
- `GET /api/openapi.json` (pública): `200` con el JSON de la spec OpenAPI
  generada.

## 2. Tiempo real: SSE

- `GET /api/scans/{scan_id}/events` (protegida,
  `gateway/src/api.rs:684-730`): `Content-Type: text/event-stream`.
- Autorización: solo el dueño de la sesión que generó `scan_id` puede
  suscribirse; si no → `404` (nunca revela existencia del scan ajeno).
- Formato: `data: <json>\n\n` (`Event::default().json_data(event)`, sin
  `event:` explícito salvo fallback de error de serialización que usa
  `event: error`). Fuente: `gateway/src/realtime.rs:146-157`.
- Shape del JSON — `ScanOutcomeEvent` (`gateway/src/domain.rs:110-176`),
  discriminado por `"status"` (`#[serde(tag = "status", rename_all =
  "snake_case")]`), **`deny_unknown_fields`**:
  ```json
  // status = "started"
  { "status": "started", "correlation_id": "scanId" }

  // status = "completed"
  {
    "status": "completed",
    "correlation_id": "scanId",
    "result": {
      "host": "string",
      "ports": [
        { "port": 22, "protocol": "tcp", "state": "open", "service": "ssh|null", "version": "string|null", "cpes": ["..."] }
      ],
      "vulnerabilities": [
        { "id": "CVE-...|null", "severity": "unknown|info|low|medium|high|critical", "description": "string", "nse_script": "string", "source": "nmap_nse|exploit_db|nvd", "references": ["..."] }
      ],
      "scanned_at": "RFC3339 string"
    }
  }

  // status = "failed"
  { "status": "failed", "correlation_id": "scanId", "reason": "string" }
  ```
- Valores de estado en el stream SSE: **`started` / `completed` /
  `failed`** (minúscula snake_case, NO `PENDIENTE`/`EN_PROGRESO`/etc — ese
  es el vocabulario del histórico REST, distinto vocabulario). El stream
  se cierra tras un evento terminal (`completed` o `failed`); `started` no
  es terminal.
- Advertencia del propio código: `ms-nmap` **todavía no publica `started`
  en producción** (contrato acordado pero no implementado del lado
  productor) — comentario en `gateway/src/domain.rs:126-129`.
- `utoipa` no modela bien SSE, así que la entrada en `/api/openapi.json`
  para este endpoint es solo una aproximación texto plano.

## 3. Manejo de sesión

- Cookie **`gateway_session`**, JWT HS256 (`jsonwebtoken`; claims `sub`,
  `email`, `name`, `exp`, `aud`, `iss` — `gateway/src/auth.rs:375-410`).
  Atributos: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age`.
- Middleware `require_session` (`gateway/src/auth.rs:488-519`) sobre todas
  las rutas protegidas (`/api/me`, `/api/profile`, `/api/scans` GET+POST,
  `/api/scans/:id/events`, `/api/scans/:id/cancel`).
- **Sin sesión válida**: `401 Unauthorized`, body texto plano:
  `"sesión inválida o ausente"` (mismo mensaje genérico para cookie
  ausente, firma inválida o expirada). **No es JSON.** El servidor de
  contrato de `front` NO debe simular un body `{"error": "..."}` para
  este 401 — el Gateway responde texto plano.

## 4. Documento de contrato / fuente de verdad

No hay OpenAPI estático en disco ni README con ejemplos de contrato. La
fuente de verdad real y viva es:
1. `gateway/src/api.rs` (handlers, `#[utoipa::path]`, `ROUTES`).
2. `GET /api/openapi.json` (runtime, verificado por
   `gateway/tests/openapi_docs.rs`).
3. `gateway/docs/architecture.md` y `gateway/docs/security-scope.md`.
4. `gateway/src/domain.rs` — shape de `ScanOutcomeEvent`/`ScanResult`
   (copiado, según sus propios comentarios, de
   `broker/contracts/scan-outcome.schema.json`).

## 5. Convención de errores

**No hay un envelope JSON de error uniforme.** Todos los errores usan
`(StatusCode, message: String).into_response()` de axum → **texto plano**
(`Content-Type: text/plain; charset=utf-8`), body = `Display`/`to_string()`
del error. Consistente en auth, profile, scans, cancel, events, rate
limit. Un cliente tipado en `front` que espere `{"error": {...}}` estaría
inventando una forma que el Gateway real no produce — debe tratar el body
de error como texto plano, con el status code como señal principal.

Reglas de qué NO se filtra en mensajes de error:
- Nunca URL/puerto/credencial interna de `ms-usuarios`/Broker (test
  `error_messages_never_include_the_base_url`).
- `401` de sesión siempre genérico.
- `404` de `scan_id` ajeno/inexistente usa el mismo mensaje/status que
  inexistente real.

## Advertencias explícitas — partes especulativas, NO contrato confirmado

1. `GET /users/me/scan-targets` (interno Gateway→ms-usuarios) "todavía no
   existe" — no afecta el contrato Gateway→front directamente (front solo
   ve `501`/`422` en `POST /api/scans` si esto falla).
2. `GET /api/profile` es JSON opaco (`serde_json::Value`) — shape real de
   `ms-usuarios` no confirmado; front no debería inventarle campos
   concretos.
3. **No existe ningún endpoint de reporte de escaneo (RF-11)** — depende
   de `ms-analisis`, que no existe como repo aún. El resultado completo
   solo llega vía el evento SSE `completed`.

## Resumen para `api_client` de `front`

- Base URL única del Gateway; todas las llamadas con `credentials:
  "include"` (cookie HttpOnly).
- Endpoints a tipar: `GET /auth/login` (solo se navega, no se fetchea),
  `POST /auth/logout`, `GET /api/me`, `GET /api/profile` (tipar como
  `unknown`/`Record<string,unknown>`), `POST /api/scans` (`{target}` →
  `{scanId}`), `GET /api/scans` (array de historial, `status` en
  `SCREAMING_SNAKE_CASE`), `POST /api/scans/{scanId}/cancel` (202, sin
  body), `GET /api/scans/{scanId}/events` (EventSource, JSON con
  discriminante `status: started|completed|failed`).
- Manejo de errores genérico: leer `status`, tratar body como string
  plano (no parsear como JSON de error).
- **No existe endpoint de reporte — `getReport(scanId)` de la feature 2 no
  tiene contraparte real en el Gateway todavía.** Esto es una decisión que
  el leader debe llevar al usuario antes de despachar el implementer (ver
  bitácora de `progress/current.md`).
