# Exploración: servidor de contrato local (REST + SSE) para `src/api` y `e2e/`

> Alcance: SOLO lectura/investigación para la feature `api_client` (id 2).
> Nada de esto es código de producción; son hallazgos y recomendaciones
> concretas para que el `implementer` diseñe `src/api` y
> `e2e/contract-server/`.

## 0. Resumen ejecutivo (para el leader)

- El contrato HTTP/SSE **ya está fijado del lado servidor** en el repo
  hermano `gateway` (implementado, no solo diseñado) — el servidor de
  contrato de `front` debe imitar exactamente esa forma, no inventar una
  propia. Ver §1 para rutas/shapes exactos citados con archivo y línea.
- El patrón de "servidor mínimo real, no mock", aunque documentado en Rust,
  es literalmente el mismo principio que pide `docs/verification.md` de
  `front`: proceso real en un puerto efímero, sin librerías de mocking de
  protocolo. Ver §1.
- Node/TS: usar el módulo nativo `http` (cero dependencias nuevas) más
  `EventSource` bundleado en Node (vía `node:` → paquete interno `undici`)
  para los tests de Vitest bajo jsdom, que **no implementa `EventSource`**
  (verificado en este mismo entorno, ver §3). No hace falta `express` ni
  ningún paquete de servidor.
- `front/package.json` no tiene ninguna dependencia de servidor HTTP hoy
  (solo `react`/`react-dom` en `dependencies`). Recomendación: no añadir
  ninguna — ver §4.

## 1. Patrón en los repos hermanos (Rust) — qué imitar en `front`

Los tres repos Rust (`broker`, `nmap-service`, `user-service`) no tienen un
"servidor de contrato" para *sí mismos* en el sentido de RF (no exponen
HTTP para SSE al navegador), pero **`gateway`** sí, y es el repo relevante
porque `front` habla exactamente con el contrato que `gateway` ya
implementó. Los hallazgos más útiles vienen de ahí:

### 1.1. Principio "servidor real en puerto efímero, no mock de protocolo"

- `gateway/progress/explore_test_idp.md` líneas 12-17: cita literal de
  `docs/conventions.md`/`docs/verification.md` de `gateway`: *"servidor
  HTTP de test real (\"escuchando en un puerto — no una interceptación a
  nivel de módulo\"), nunca un mock del protocolo"*. Ese mismo documento
  evalúa explícitamente `wiremock` (equivalente Rust de `msw`) y lo
  **descarta por defecto** a favor de un servidor `axum` nativo, "por no
  añadir dependencia" y por homogeneidad con el resto del repo (líneas
  53-67, 277-311). Esto es el precedente directo para preferir Node `http`
  nativo sobre traer un framework a `front` solo para el contract-server.
- `gateway/progress/explore_sse.md` §4 (líneas 227-293): patrón confirmado
  en el propio código de `gateway` (`tests/scan_submission.rs`,
  `tests/session_middleware_and_me.rs`, etc.): `TcpListener::bind("127.0.0.1:0")`
  (puerto efímero) + servidor spawneado en background + cliente HTTP real
  contra `http://127.0.0.1:{puerto}`. Traducción directa a Node: `http.createServer().listen(0)`
  y leer `server.address().port`.
- `broker/contracts/README.md` (líneas 1-9): principio "el contrato se
  copia literalmente de quien ya lo implementa, no se re-deriva" — aplica
  igual aquí: el contract-server de `front` debe copiar el shape exacto de
  `gateway/src/api.rs` (citado abajo), no inventar uno "razonable".

### 1.2. Contrato HTTP exacto que `gateway` ya implementa (fuente de verdad)

Tabla de rutas confirmada en `gateway/src/api.rs` líneas 894-943 (`pub const ROUTES`):

| Método | Path | Protegida (cookie sesión) |
|---|---|---|
| GET | `/auth/login` | no |
| GET | `/auth/callback` | no |
| POST | `/auth/logout` | no |
| GET | `/health` | no |
| GET | `/api/me` | sí |
| GET | `/api/profile` | sí |
| POST | `/api/scans` | sí |
| GET | `/api/scans` | sí |
| GET | `/api/scans/:scan_id/events` | sí (SSE) |
| POST | `/api/scans/:scan_id/cancel` | sí |
| GET | `/api/openapi.json` | no |

Shapes de body confirmados (mismo archivo):

- `GET /api/me` → 200 `{ sub, email, name }` (`MeResponse`, líneas 393-398).
  401 si no hay sesión/expirada.
- `POST /api/scans` body `{ target }` (líneas 535-537) → 201/200
  `{ "scanId": "<uuid>" }` (líneas 543-547, nótese `scanId` camelCase vía
  `#[serde(rename = "scanId")]`, mientras internamente Rust usa
  `scan_id` — **el wire format es `scanId`**). Errores: `400` (target
  inválido), `501` (dependencia de `ms-usuarios` no implementada), `422`
  (sin credenciales configuradas), `502`/`504` (`ms-usuarios`/Broker
  caídos) — ver `ScanSubmitError`/`UsuariosClientError` `IntoResponse`,
  líneas 1193-1240.
- `GET /api/scans` → 200 `[{ scanId?, target, status, requested_at,
  updated_at }]` (`ScanHistoryEntryResponse`, líneas 469-483). `scanId` es
  **opcional** (`skip_serializing_if`) — el cliente de `front` debe tratarlo
  como posiblemente ausente, no asumir que siempre viene. `status` es un
  enum `ScanStatus` `SCREAMING_SNAKE_CASE` (confirmado por
  `docs/conventions.md`/RF-07/RF-08 de `front`: `PENDIENTE`/`EN_PROGRESO`/
  `COMPLETADO`/`FALLIDO`).
- `POST /api/scans/:scan_id/cancel` → `202 Accepted` si se publica la
  cancelación, `409 Conflict` si el escaneo ya está en estado terminal,
  `404` si el `scan_id` no existe o no pertenece a la sesión (mismo patrón
  uniforme "ajeno == inexistente", ver `gateway/progress/impl_scan_history_and_cancellation.md`).
- **Cuerpos de error son texto plano, no JSON**: confirmado en
  `IntoResponse for AuthError`/`UsuariosClientError`/`ScanSubmitError`
  (líneas 1169-1240): `(status, self.to_string()).into_response()` — el
  header `content-type` de esas respuestas de error es texto, no
  `application/json`. **Implicación directa para `ApiError` de `front`**:
  el parseo de error de `src/api` no puede asumir `await res.json()` en el
  camino de error (fallaría al parsear texto plano) — debe decidir el
  `ApiError.kind` a partir del `status` HTTP primero, y tratar el body como
  texto opcional solo para logging de debug (nunca mostrado tal cual al
  usuario, ver `docs/conventions.md` línea 77-78).

### 1.3. Contrato SSE exacto (`GET /api/scans/:scan_id/events`)

Confirmado en `gateway/progress/explore_sse.md` (líneas 12-41, 183-214) y
`gateway/src/domain.rs` (líneas 110-176, 240-340):

- `Content-Type: text/event-stream`, `Cache-Control: no-cache` (puestos
  automáticamente por `axum::response::sse::Sse`).
- Cada evento es un evento SSE **por defecto** (sin `event:` nombrado, salvo
  el caso de error de serialización que usa `event: error`) con `data:` =
  JSON de un `ScanOutcomeEvent`, discriminado por el campo `status`:
  ```json
  {"status":"started","correlation_id":"<scanId>"}
  {"status":"completed","correlation_id":"<scanId>","result":{"host":"...","ports":[...],"vulnerabilities":[...],"scanned_at":"..."}}
  {"status":"failed","correlation_id":"<scanId>","reason":"..."}
  ```
  (`deny_unknown_fields`, `additionalProperties: false` — el contract
  server no debe añadir campos extra).
- El stream **se cierra ordenadamente** (fin de la respuesta HTTP, no un
  `error` de red) justo después de emitir un evento terminal
  (`completed`/`failed`) — nunca se queda abierto indefinidamente tras eso.
  Esto es importante para el contract server: debe cerrar la conexión
  (`res.end()`), no dejarla colgada, tras el evento terminal.
- No hay campo `id:` de SSE documentado, y no se menciona un `retry:`
  explícito — el reconector de `EventSource` usa su valor por defecto del
  navegador (~3s) salvo que el servidor mande `retry:` explícito. El
  contract server puede opcionalmente mandar `retry: 1000` (o similar) para
  que los tests e2e que fuercen una reconexión no esperen 3s de más — es
  una decisión de implementación del contract server, no del contrato real
  (`gateway` no lo hace, así que no imitarlo ahí sería igual de "fiel", pero
  acelera los tests).
- `front/feature_list.json` (id=7, `scan_outcome_relay`, en `gateway`) usa
  `PENDIENTE`/`EN_PROGRESO`/`COMPLETADO`/`FALLIDO` como los 4 estados
  visibles en la UI (RF-07/08 de `front/docs/architecture.md`), mientras el
  wire format de `ScanOutcomeEvent` usa `started`/`completed`/`failed`
  (inglés, sin un estado explícito "pendiente" — el pendiente es "antes de
  que llegue ningún evento SSE", implícito). El mapeo `started → EN_PROGRESO`
  es una traducción que debe vivir en `src/domain`/`src/features`, no en
  `src/api` (que solo tipa el wire format tal cual).

## 2. Patrón Node/TS para servidor HTTP+SSE mínimo, arrancable desde Playwright y Vitest

### 2.1. Servidor con `http` nativo (sin framework)

```ts
// e2e/contract-server/server.ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export function startContractServer(port = 0) {
  const server = createServer(handleRequest);
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        url: `http://127.0.0.1:${actualPort}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
```

- `listen(0, ...)` deja que el SO asigne un puerto libre — evita colisiones
  entre ejecuciones paralelas de Playwright (`fullyParallel: true`, ya
  configurado en `playwright.config.ts`) y entre un run de Vitest y uno de
  Playwright simultáneos.
- Enrutado manual por `req.method`/`req.url` (con `new URL(req.url, "http://localhost")`
  para extraer path/query) es suficiente para ~7 endpoints; no hace falta
  un router de terceros. Si el árbol de rutas creciera mucho, revisar
  entonces (no ahora, mismo principio de "no sobre-ingeniería" que aplican
  los repos Rust hermanos, p. ej. `gateway/progress/explore_sse.md` línea
  408-410 al descartar `dashmap`).

### 2.2. Endpoint SSE con timings controlables

```ts
function handleScanEvents(scanId: string, res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const script = scenarioFor(scanId); // secuencia + delays, controlada por fixture
  let i = 0;
  const timer = setInterval(() => {
    if (i >= script.length) {
      clearInterval(timer);
      res.end();
      return;
    }
    const event = script[i++];
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (isTerminal(event)) {
      clearInterval(timer);
      res.end();
    }
  }, script[i]?.delayMs ?? 500);

  res.on("close", () => clearInterval(timer)); // cliente cortó la conexión
}
```

- `res.write("data: ...\n\n")` es el framing mínimo de SSE — igual que
  documenta `gateway/progress/explore_sse.md` línea 258-260 para el lado
  Rust ("el propio `axum::response::sse` tampoco usa ninguna crate para
  esto, así que es razonable no añadir una para el lado cliente/servidor de
  test" — mismo razonamiento aplica en Node).
  `res.on("close", ...)` es necesario para limpiar el `setInterval` cuando
  un test cierra el `EventSource` antes de que termine el guion — evita
  handles colgados que impedirían a Node salir limpiamente entre tests.
- **Simular un corte de conexión** (para probar la reconexión automática de
  `EventSource`, pregunta 3): el contract server puede exponer un
  escenario/fixture que llama a `res.destroy()` (no `res.end()`) a mitad de
  la secuencia — eso simula un corte real de TCP, que es justo lo que
  dispara el reconector nativo de `EventSource` (`readyState` pasa a
  `CONNECTING`, se dispara el evento `error`, y el navegador reintenta solo
  tras el intervalo `retry`).

### 2.3. Arranque desde Playwright

`playwright.config.ts` ya tiene una entrada `webServer` (para `vite
preview`). Playwright soporta un **array** de `webServer`, cada uno con su
propio `command`/`url`/`port`:

```ts
webServer: [
  {
    command: "npx tsx e2e/contract-server/main.ts",
    url: "http://127.0.0.1:4000/health",
    reuseExistingServer: !process.env["CI"],
  },
  {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
  },
],
```

Esto exige que el contract server escuche en un **puerto fijo conocido**
(no `listen(0)`) cuando lo arranca Playwright vía `webServer` — Playwright
solo sabe hacer polling a una URL fija, no leer un puerto dinámico impreso
por stdout. Alternativa sin fijar puerto: usar `globalSetup`/`globalTeardown`
(`playwright.config.ts` → `globalSetup: "./e2e/global-setup.ts"`) que arranca
el servidor programáticamente con `startContractServer(0)`, guarda la URL
resultante en una variable de entorno (`process.env["CONTRACT_SERVER_URL"]`)
que el propio build de Vite expone a `front` (ver §4 sobre `VITE_*`), y la
cierra en `globalTeardown`. Esto es más flexible (puerto dinámico, sin
colisión) pero requiere que la URL del Gateway que usa `front` sea
configurable en tiempo de build/arranque del `preview` — coherente con la
propia feature (`acceptance`: "La URL base del Gateway se lee de
configuración de build... nunca hardcodeada").
**Recomendación**: puerto fijo + `webServer` array es más simple para
empezar (menos piezas móviles); mover a `globalSetup` si las ejecuciones en
paralelo de Playwright chocan por puerto.

- `npx tsx` (o `node --experimental-strip-types`, disponible en Node ≥22.6
  sin flag desde 23.6) evita compilar el contract server a JS por separado.
  Confirmar versión de Node del entorno CI antes de decidir (`node
  --version` en este entorno da **v26.7.0**, así que `node
  e2e/contract-server/main.ts` en TypeScript nativo ya funciona sin `tsx`
  ni build previo — ver §3 sobre `type: "module"`, ya presente en
  `package.json`).

### 2.4. Arranque desde Vitest (unitarios de `src/api`)

Patrón in-process, sin proceso separado ni Playwright:

```ts
// tests/api/setup.ts o dentro de cada archivo de test
import { beforeAll, afterAll } from "vitest";
import { startContractServer } from "../../e2e/contract-server/server";

let baseUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ url: baseUrl, close } = await startContractServer(0));
});
afterAll(() => close());
```

Reutilizar el **mismo** `e2e/contract-server/server.ts` desde Vitest (no
duplicar un segundo servidor de test) es lo que garantiza que "servidor de
contrato" y "servidor HTTP real para tests unitarios de `src/api`" sean
literalmente el mismo código — evita que diverjan con el tiempo. Esto
también responde a la restricción de `docs/verification.md`
("nunca interceptando `fetch`... contra el servidor de contrato o un
servidor HTTP de test en memoria") de forma más fuerte: es *el mismo*
servidor de contrato, no uno paralelo.

## 3. `EventSource` en el navegador: reconexión y estado expuesto a React

### 3.1. Lo que ya hace `EventSource` nativo (sin librería)

- Reconecta solo tras cualquier error de red o cierre inesperado de la
  conexión (no tras `es.close()` explícito). Intervalo por defecto ~3s,
  configurable por el servidor con la línea `retry: <ms>` en el stream SSE
  (ver §2.3).
- `EventSource.readyState`: `0 CONNECTING`, `1 OPEN`, `2 CLOSED`. Eventos
  nativos: `open` (pasa a OPEN), `error` (dispara en fallo Y en cada
  reintento fallido — no distingue "error fatal" de "reintentando"; solo
  `readyState` lo distingue: si tras `error` el `readyState` sigue siendo
  `CONNECTING`, está reintentando; si es `CLOSED`, el navegador se rindió,
  lo cual **solo ocurre si el propio código llamó a `.close()`** dentro del
  handler de error, o si el servidor respondió con un status HTTP que no es
  200 en el intento de reconexión (p. ej. 401/404) — un `EventSource` nunca
  se "rinde" solo por reintentos fallidos de red, reintenta indefinidamente.

### 3.2. Helper mínimo recomendado (sin dependencias nuevas)

```ts
// src/api/scanEvents.ts (boceto, no implementación final)
export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface ScanEventsSubscription {
  close(): void;
}

export function subscribeToScanEvents(
  scanId: string,
  onEvent: (event: ScanOutcomeEvent) => void,
  onStatusChange: (status: ConnectionStatus) => void,
): ScanEventsSubscription {
  const es = new EventSource(`${baseUrl()}/api/scans/${scanId}/events`, {
    withCredentials: true, // imprescindible: la sesión viaja en cookie HttpOnly (docs/security-scope.md)
  });
  let everOpened = false;

  es.addEventListener("open", () => {
    everOpened = true;
    onStatusChange("open");
  });
  es.addEventListener("error", () => {
    // readyState ya refleja si el navegador va a reintentar o se rindió
    onStatusChange(es.readyState === EventSource.CLOSED ? "closed" : "reconnecting");
  });
  es.addEventListener("message", (ev: MessageEvent<string>) => {
    onEvent(JSON.parse(ev.data) as ScanOutcomeEvent); // parseo/validación real: fuera de este boceto
  });
  onStatusChange(everOpened ? "open" : "connecting");

  return {
    close: () => {
      es.close();
      onStatusChange("closed");
    },
  };
}
```

- **`withCredentials: true` es obligatorio**, no opcional: sin él,
  `EventSource` no envía la cookie `HttpOnly`/`Secure`/`SameSite=Strict` de
  sesión (ver `docs/security-scope.md`), y toda conexión SSE fallaría con
  401 — punto fácil de pasar por alto porque el `fetch` de las demás
  funciones de `src/api` necesita el `credentials: "include"` equivalente.
- Exponer el estado vía **callback** (`onStatusChange`), no vía un valor de
  retorno síncrono ni una promesa: el estado cambia de forma asíncrona
  varias veces durante la vida de la suscripción, y un hook de React
  (`useScanEvents`, ya previsto en `docs/conventions.md` como nombre de
  archivo) puede envolver este callback con `useState`/`useReducer`
  fácilmente. Esto es lo que lo hace testeable: un test de Vitest puede
  llamar a `subscribeToScanEvents` contra el contract server real (§2.4),
  forzar un corte de conexión (fixture que hace `res.destroy()`), y
  aserlar la secuencia de `onStatusChange` (`connecting → open →
  reconnecting → open → ...`) sin mockear `EventSource`.

### 3.3. Gotcha verificado en este entorno: `EventSource` no existe en jsdom

Confirmado ejecutando en este mismo repo:

```
$ node -e "console.log(typeof EventSource)"
undefined
$ node -e "const {EventSource} = require('undici'); console.log(typeof EventSource)"
function
```

- `jsdom` (versión `30.1.0`, ya en `devDependencies`) **no implementa
  `EventSource`** (no hay ninguna referencia en
  `node_modules/jsdom/lib/jsdom/living/`) — un test de Vitest bajo
  `environment: "jsdom"` (configurado así en `vitest.config.ts`) que llame
  a `new EventSource(...)` fallará con `ReferenceError` si no se provee un
  polyfill.
- Node **sí** trae una implementación de `EventSource` internamente (vía el
  módulo interno `undici`, que Node vendoriza), accesible con `const {
  EventSource } = require("undici")` (o `import { EventSource } from
  "undici"` — `undici` no necesita instalarse como dependencia, ya viene
  con Node ≥ 18.x para `fetch`, y su export de `EventSource` está disponible
  en Node 22+; confirmado disponible en la v26.7.0 de este entorno). También
  existe como global si se lanza Node con `--experimental-eventsource`, pero
  **no** es necesario depender del flag: importar desde `"undici"`
  directamente funciona sin flags, como se verificó arriba.
- **Recomendación concreta para `tests/setup.ts`** (ya existe, referenciado
  por `vitest.config.ts` línea 14): poner ahí
  ```ts
  import { EventSource } from "undici";
  if (typeof globalThis.EventSource === "undefined") {
    // @ts-expect-error -- polyfill de test: jsdom no implementa EventSource,
    // Node sí (vía undici) — nunca se envía a producción, solo corre en Vitest.
    globalThis.EventSource = EventSource;
  }
  ```
  Esto es **cero dependencias nuevas** (`undici` no se añade a
  `package.json`, se importa como módulo interno de Node) y mantiene
  `src/api` escribiendo `new EventSource(...)` tal cual lo haría en un
  navegador real, sin inyección de dependencias artificial solo para
  testear. Justificación documentable en el propio `tests/setup.ts` (mismo
  espíritu que `docs/conventions.md` "Comentarios... solo cuando explican
  un *por qué* no obvio").
- Los tests **e2e** (Playwright) no tienen este problema: corren en un
  navegador real (Chromium/Firefox/WebKit vía `@playwright/test`, ya
  `devDependency`) que sí implementa `EventSource` nativo — el polyfill
  de `undici` es exclusivamente para los tests unitarios de Vitest.

## 4. `package.json`: dependencias de servidor — no hay ninguna hoy

Confirmado leyendo `front/package.json`:

- `dependencies`: solo `react`, `react-dom`. Ninguna librería de servidor
  HTTP, routing, ni SSE.
- `devDependencies`: stack de build/test ya visto (`vite`, `vitest`,
  `@playwright/test`, `jsdom`, `@testing-library/*`, `eslint`+plugins,
  `prettier`, `typescript`) — tampoco hay `express`, `fastify`, `koa`,
  `msw`, `supertest`, ni ningún cliente/servidor HTTP adicional.

**Recomendación: usar el módulo nativo `node:http`, sin añadir ninguna
dependencia nueva.** Motivos, en línea con `docs/security-scope.md`
("cualquier paquete npm nuevo se justifica... por qué no una alternativa ya
presente"):

1. El contract server necesita servir ~7 endpoints REST simples + 1 SSE.
   `node:http` cubre esto en unas ~150-250 líneas sin abstracciones extra
   (routing manual por `req.method + pathname`); no hay lógica de negocio
   real que justifique un framework.
2. El propio Gateway real (`axum`) tampoco usa nada más pesado de lo
   necesario para SSE (ver §1.1) — mismo principio de "no sobre-ingeniería"
   ya aplicado explícitamente en los repos hermanos
   (`gateway/progress/explore_sse.md` líneas 408-410, `explore_test_idp.md`
   líneas 53-67).
3. Una dependencia de servidor (`express`, etc.) solo viviría en
   `devDependencies`/código de test (`e2e/contract-server/`, nunca se
   bundlea a producción vía `vite build`), pero igual sumaría superficie a
   auditar (transitively, `express` trae ~30-60 paquetes) por una ganancia
   marginal (routing declarativo) que no hace falta a esta escala.
4. Si en el futuro el contract server creciera mucho (autenticación de
   sesión más elaborada, middlewares, etc.) y `node:http` se volviera
   incómodo, es una decisión a revisar entonces con justificación concreta
   — no ahora, "por si acaso".

**Única pieza que sí podría justificarse como dependencia nueva** (opcional,
no bloqueante): un ejecutor de TypeScript para lanzar
`e2e/contract-server/main.ts` sin paso de build (`tsx`) si `node
--experimental-strip-types`/`node <archivo>.ts` nativo (ya disponible sin
flags en Node ≥23.6, y este entorno corre **v26.7.0**) no cubriera algún
caso de sintaxis TS no soportada (p. ej. `enum`, decoradores con metadata
— el contract server no debería necesitarlos si se escribe con tipos/
interfaces planas). Recomendación: **probar primero con `node` nativo sin
`tsx`** antes de añadir la dependencia; en este entorno concreto no debería
hacer falta.

## Referencias citadas (archivo:línea)

- `front/docs/architecture.md` líneas 37-43 (SSE, no WebSocket), 59-63
  (capa `src/api`).
- `front/docs/conventions.md` líneas 56-63 (Nivel 1/2 de test), 67-78
  (`ApiError`).
- `front/docs/verification.md` líneas 32-56 (servidor de contrato,
  anti-patrones de mockear `fetch`/`src/api`).
- `front/docs/security-scope.md` líneas 12-30 (cookie `HttpOnly`, nunca
  tokens en JS), 38-40 (justificar dependencias nuevas).
- `front/feature_list.json` id=2 (`api_client`, criterios de aceptación
  citados literalmente en §0/§1).
- `gateway/src/api.rs` líneas 393-547, 894-943, 1169-1240 (shapes exactos y
  tabla de rutas).
- `gateway/src/domain.rs` líneas 110-176 (`ScanOutcomeEvent`).
- `gateway/progress/explore_sse.md` (patrón SSE axum + testing).
- `gateway/progress/explore_test_idp.md` (principio "servidor real,
  no mock de protocolo", evaluación y descarte de `wiremock`).
- `gateway/progress/impl_scan_history_and_cancellation.md` (shapes de
  histórico/cancelación, códigos 202/409/404).
- `broker/contracts/README.md` líneas 1-9 (principio "el contrato se copia
  literalmente de quien ya lo implementa").
- Verificación directa en este entorno: `node --version` → `v26.7.0`;
  `node -e "console.log(typeof EventSource)"` → `undefined`; `node -e
  "const {EventSource}=require('undici'); console.log(typeof EventSource)"`
  → `function`; `node_modules/jsdom` en `30.1.0` sin referencias a
  `EventSource`.
