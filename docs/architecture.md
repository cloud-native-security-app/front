# Arquitectura — Qué significa "hacer un buen trabajo"

> Este documento define el estándar de calidad. Los agentes revisores
> evalúan código contra este archivo. Si no está aquí, no es un requisito.

## Alcance de este repo

Este repo implementa **únicamente `front`**: la SPA que corre en el
navegador del analista. Habla **solo** con el Gateway — nunca directo con
`ms-usuarios`, `ms-nmap`, `ms-analisis`, el Broker, ni el Identity Provider.
El Gateway, los microservicios y el Broker son otros repos — no se
implementan aquí y este repo no conoce su lógica interna, solo el contrato
HTTP/eventos que el Gateway expone.

```
Browser (front) ──HTTPS──▶ Gateway ──▶ Identity Provider (Google OAuth2/OIDC)
       │                      │
       │                      └──▶ ms-usuarios / Broker / ms-nmap / ms-analisis
       │
       └──(estado en tiempo real, RF-08)──◀── Gateway
```

## Decisiones de diseño ya tomadas

- **React + TypeScript + Vite.** Vite por velocidad de dev-server/build y
  ser el estándar de facto para SPA sin necesidad de SSR (este servicio no
  lo necesita: no hay contenido a indexar, es una herramienta autenticada).
- **`front` nunca maneja el token OAuth de Google.** El login es: `front`
  redirige al usuario a una ruta del Gateway (p. ej. `/auth/login`), el
  Gateway hace el handshake OIDC completo con Google y, al volver,
  establece la sesión mediante una **cookie `HttpOnly` + `Secure` +
  `SameSite=Strict`** que el JavaScript de `front` nunca puede leer. `front`
  solo sabe si hay sesión activa consultando un endpoint del Gateway (p. ej.
  `GET /api/me`) — nunca decodifica ni inspecciona el token. Esto es una
  decisión de seguridad explícita (ver `docs/security-scope.md`), no una
  omisión: reduce drásticamente la superficie de robo de sesión vía XSS.
- **Notificación en tiempo real vía Server-Sent Events (SSE, RF-08)**, no
  WebSocket: el canal es unidireccional (Gateway → `front`, solo desenlaces
  de escaneo) y SSE reconecta automáticamente en el navegador sin librería
  adicional. La cancelación (RF-14) es una acción aparte, un `POST` normal
  contra el Gateway — no necesita ida y vuelta por el mismo canal. Si en el
  futuro se necesita comunicación bidireccional en tiempo real, es una
  decisión a discutir explícitamente, no se asume aquí.
- **Validación de IP/rango en el cliente (RF-03) es UX, no el límite de
  seguridad real.** `front` valida el formato antes de enviarlo para dar
  feedback inmediato, pero la validación autoritativa vive en el Gateway/
  `ms-usuarios` — `front` nunca asume que su propia validación es
  suficiente para considerar la entrada seria.
- **Gestión de estado de servidor con una librería de fetching
  (p. ej. TanStack Query)** para las llamadas al Gateway (caché, reintentos,
  invalidación tras acciones como cancelar un escaneo) en vez de estado
  global hecho a mano — se confirma/ajusta en la feature `scaffolding` si
  aparece una razón concreta para no usarla.
- **Sin SSR ni generación estática.** Es una herramienta interna autenticada,
  no un sitio público — no hay requisito de SEO ni de contenido pre-render.

## Capas

1. **`src/api`** — único módulo que conoce la URL base del Gateway y su
   contrato HTTP/SSE. Expone funciones tipadas (`login()`, `getMe()`,
   `submitScan(target)`, `getScanHistory()`, `cancelScan(scanId)`,
   `subscribeToScanEvents(onEvent)`, `getReport(scanId)`). Ningún otro
   módulo hace `fetch`/`EventSource` directo.
2. **`src/auth`** — estado de sesión derivado de `GET /api/me` (nunca de un
   token propio); componente de ruta protegida que redirige a login si no
   hay sesión.
3. **`src/features/scan`** — formulario de nueva solicitud de escaneo:
   input de IP/rango + validación de formato (RF-02/RF-03) + envío
   (RF-04) + estado en tiempo real del escaneo recién creado (RF-07/RF-08).
4. **`src/features/history`** — tabla de histórico (RF-13) con acción de
   cancelar (RF-14) sobre escaneos en `PENDIENTE`/`EN_PROGRESO`.
5. **`src/features/report`** — visualización del reporte consolidado de un
   escaneo `COMPLETADO` y su exportación (RF-11).
6. **`src/components`** — componentes de UI puros y reutilizables, sin
   conocimiento del Gateway.
7. **`src/routes`** — enrutado (React Router): login, formulario de
   escaneo, histórico, detalle/reporte de un escaneo.
8. **`src/main.tsx` / `src/App.tsx`** — arranque de la aplicación: monta el
   router, el provider de la librería de fetching, y el guard de
   autenticación.

No introducir capas adicionales hasta que haya una razón concreta
documentada en `feature_list.json`.

## Manejo de errores

- Todo error de red/HTTP de `src/api` se tipa (nunca un `throw` de un
  string suelto ni un `any` sin forma) y se traduce en una UI de error
  explícita — nunca una pantalla en blanco ni una promesa no manejada.
- Un `401`/`403` del Gateway redirige al login; nunca se reintenta
  silenciosamente ni se cachea como si fuera una respuesta válida.
- Los datos personales (email, nombre) que devuelve `GET /api/me` se
  muestran en la UI (es lo esperado, es la sesión del propio usuario) pero
  nunca se loggean en consola ni se envían a un servicio de terceros
  (analítica, error tracking) sin anonimizar — ver `docs/security-scope.md`.

## Despliegue

> Detalle práctico (comando de build, dónde se sirven los assets
> estáticos) se documenta en `README.md` una vez exista la feature
> `containerization` — esta sección explica el *por qué*, no lo duplica.

`front` compila a assets estáticos (`vite build`) servidos por un servidor
HTTP simple (o una CDN/bucket estático) detrás del mismo dominio público que
enruta al Gateway — no empaqueta ningún runtime de Node en producción. No se
asume todavía un proveedor cloud concreto, mismo principio que documentan
`broker`/`nmap-service`/`user-service` en sus propios `docs/architecture.md`.

## Qué NO hacer

- No manejar, decodificar ni persistir (`localStorage`/`sessionStorage`) el
  token OAuth de Google ni ninguna credencial de servicio.
- No llamar directamente a `ms-usuarios`, `ms-nmap`, `ms-analisis`, el
  Broker o el Identity Provider — solo al Gateway.
- No tratar la validación de IP/rango del cliente como si fuera la
  autorización real del objetivo.
- No introducir un segundo canal de tiempo real (WebSocket) sin que el
  usuario lo pida explícitamente.
