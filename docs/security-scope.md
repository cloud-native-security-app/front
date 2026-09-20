# Alcance de seguridad y autorización

> `front` corre en el navegador del usuario final — el entorno menos
> confiable de toda la plataforma (cualquier extensión de navegador
> maliciosa, XSS, o dependencia de npm comprometida corre con los mismos
> privilegios que el propio código de la aplicación). Este documento define
> los límites duros que aplican tanto al desarrollo (tests, ejemplos, datos
> de prueba) como al diseño del propio cliente. No es un documento legal —
> es la guía práctica que un agente de código debe seguir antes de tocar
> login, sesión, o la comunicación con el Gateway.

## Sesión y tokens

- `front` **nunca** maneja, decodifica, ni persiste el token OAuth/OIDC de
  Google. El login es siempre una redirección de navegador completa hacia
  una ruta del Gateway; la sesión resultante vive en una cookie
  `HttpOnly` + `Secure` + `SameSite=Strict` que el JavaScript de esta app
  **no puede leer por diseño** — eso es justamente lo que la protege de
  robo vía XSS.
- **Nunca** se guarda ningún token, credencial o identificador de sesión en
  `localStorage`, `sessionStorage`, ni en una variable global accesible
  desde la consola del navegador. Si una feature pareciera requerirlo,
  **para y pregunta al usuario** — probablemente hay una forma de hacerlo
  vía cookie gestionada por el Gateway.
- El estado de "hay sesión activa" se deriva **siempre** de una llamada real
  al Gateway (p. ej. `GET /api/me`), nunca de inspeccionar una cookie o
  asumir que "si no hay error, hay sesión".
- Un `401`/`403` de cualquier llamada al Gateway limpia el estado de sesión
  en memoria de la app y redirige a login — nunca se reintenta con
  credenciales viejas ni se muestra contenido protegido "por si acaso".

## Superficie de ataque del cliente

- **XSS:** nunca usar `dangerouslySetInnerHTML` (React) con contenido que
  no haya sido sanitizado explícitamente; el contenido que viene del
  Gateway/otros usuarios (p. ej. un campo de texto libre en un reporte) se
  trata como no confiable.
- **Dependencias:** cualquier paquete npm nuevo se justifica en el informe
  del implementer (qué problema resuelve, por qué no una alternativa ya
  presente) — mismo espíritu que la justificación de cada dependencia
  nueva en `Cargo.toml` en los repos Rust de esta plataforma.
- **CSP:** el despliegue final (feature `containerization`) debe servir una
  `Content-Security-Policy` que restrinja `connect-src` al dominio del
  Gateway — no se añade un dominio de terceros (analítica, fuentes, CDNs)
  sin que el usuario lo apruebe explícitamente.
- **Sin llamadas directas a servicios internos.** `front` solo conoce la
  URL del Gateway (vía configuración de build, nunca hardcodeada). Nunca
  añade una URL de `ms-usuarios`, `ms-nmap`, `ms-analisis`, el Broker o el
  Identity Provider — eso rompería el aislamiento de subred privada que
  documentan esos repos.

## Datos personales

- El perfil del propio usuario (email, nombre, devueltos por
  `GET /api/me`) se muestra en la UI porque es su propia sesión, pero
  **nunca** se envía a un servicio de terceros (analítica, error tracking,
  logging remoto) sin anonimizar explícitamente, ni se imprime en
  `console.*` en código que llega a producción.
- Ningún test, fixture o ejemplo de este repo usa una cuenta de Google
  real: se generan identidades sintéticas de laboratorio (p. ej.
  `test-user-<n>@example.test`) servidas por el servidor de contrato de
  `docs/verification.md`.

## Validación de entrada

- La validación de formato de IP/rango en el cliente (RF-02/RF-03) es una
  mejora de experiencia de usuario, **no** el control de seguridad real —
  nunca se documenta ni se comunica como si bastara por sí sola. La
  autorización real de qué objetivo puede escanear qué usuario vive
  aguas arriba (Gateway/`ms-usuarios`).

## Si algo no está claro

Si una feature de `feature_list.json` roza alguno de estos límites y no está
claro cómo proceder, el agente **para y pregunta al usuario** en vez de
asumir qué está autorizado — igual que cualquier otro bloqueo, se documenta
en `progress/current.md`.
