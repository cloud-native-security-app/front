# front

SPA (React + TypeScript + Vite) de una plataforma de ciberseguridad blue/red
team: la interfaz que usa el analista para autenticarse, solicitar un
escaneo, ver su estado en tiempo real, consultar su histórico y revisar el
reporte final.

Este repo implementa **únicamente** `front`. El Gateway, `ms-usuarios`,
`ms-nmap`, `ms-analisis` y el Broker viven en otros repos. `front` habla
**solo** con el Gateway: nunca directo con un microservicio interno ni con
el Identity Provider. No implementes aquí lógica de negocio de ninguno de
ellos.

## Responsabilidades

- Iniciar sesión delegando el login en el Gateway (Google OAuth 2.0 / OIDC,
  RF-01). `front` nunca maneja el token OAuth de Google.
- Ingresar una IP/rango como objetivo, validando el formato en el cliente
  (RF-02/RF-03).
- Encolar el escaneo vía el Gateway y mostrar de inmediato el `scanId`
  (RF-04).
- Reflejar en tiempo real el estado del escaneo
  (`PENDIENTE`/`EN_PROGRESO`/`COMPLETADO`/`FALLIDO`, RF-07/RF-08) por SSE.
- Cancelar un escaneo `PENDIENTE`/`EN_PROGRESO` (RF-14).
- Mostrar el histórico de escaneos del usuario (RF-13).
- Visualizar y exportar el reporte consolidado (RF-11).

**Seguridad**: este código corre en el navegador del usuario, el entorno
menos confiable de la plataforma. Nunca debe manejar ni persistir el token
OAuth ni credenciales internas; solo confía en que el Gateway ya autenticó
la sesión (cookie `HttpOnly`). Antes de tocar login, sesión o llamadas al
Gateway, lee [`docs/security-scope.md`](docs/security-scope.md).

## Stack

React + TypeScript + Vite, `vitest` + Testing Library, `playwright`
(end-to-end contra un servidor de contrato local), `eslint` + `prettier`.

## Documentación

- [`docs/architecture.md`](docs/architecture.md): capas, decisiones de diseño, despliegue.
- [`docs/conventions.md`](docs/conventions.md): estilo, nombres, estructura.
- [`docs/verification.md`](docs/verification.md): cómo demostrar que el trabajo funciona.
- [`docs/security-scope.md`](docs/security-scope.md): límites de autorización y alcance.
- [`docs/decisions.md`](docs/decisions.md): decisiones relevantes del historial del proyecto.

## Desarrollo

```bash
npm ci
npm run dev        # servidor de desarrollo (requiere VITE_GATEWAY_BASE_URL)
npm run verify     # format:check, lint, typecheck, test, build, test:e2e
```

`npm run verify` es la verificación completa previa a dar una tarea por
terminada. `build` corre antes de `test:e2e` a propósito: Playwright sirve
`dist/` con `vite preview`, y una build vieja daría un falso verde. Los e2e
requieren `npx playwright install` al menos una vez por entorno.

## Despliegue

La imagen se construye con el `Dockerfile` (multi-stage, nginx no-root).
`VITE_GATEWAY_BASE_URL` es un build-arg obligatorio: se incrusta en el bundle
y también parametriza `connect-src` de la CSP. Ver
[`docs/architecture.md`](docs/architecture.md). El pipeline de CI/CD está
planificado en [`odd/tasks/ci-cd-deploy.md`](odd/tasks/ci-cd-deploy.md).

## Desarrollo asistido por IA

El repositorio se trabaja con [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)
y Engram (memoria persistente). El flujo es Organic Driven Development: los
planes de trabajo sustanciales viven en `odd/tasks/<feature>.md` (con espejo
en Engram bajo `odd/<feature>/tasks`) y se cierran tarea por tarea con
commits convencionales. Las skills de terceros están en `.agents/skills/`
(fijadas en `skills-lock.json`) y el registro de skills en `.atl/`.
