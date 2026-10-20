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
[`docs/architecture.md`](docs/architecture.md). El pipeline de CI/CD se
describe en la sección siguiente.

## CI/CD

### En cada pull request y push a `develop` (`.github/workflows/ci.yml`)

- **verify**: Node 22 (el mismo del builder del `Dockerfile`), `npm ci`,
  Chromium de Playwright y `npm run verify` (format:check, lint, typecheck,
  vitest, build y e2e). Los e2e son autocontenidos (servidor de contrato +
  `vite preview`), no necesitan backend. Si falla, se sube el reporte de
  Playwright como artefacto.
- **docker-build**: `docker build` sin push, con
  `VITE_GATEWAY_BASE_URL=https://gateway.ci.invalid:8080` (valor de relleno).

### En push a `main` (`.github/workflows/deploy.yml`)

Construye la imagen, la publica en ECR como `security-app/front:<sha>` (y
`:latest`) y despliega en el servicio ECS `front` del cluster
`security-app-cluster-v2`. Terraform (repo `infra`) es la única fuente de
verdad de la task definition: CI solo descarga la task definition vigente del
servicio, cambia la imagen del contenedor `front` por `<sha>`, registra la
nueva revisión y espera la estabilidad del servicio. Nada de esto se versiona
en este repo.

`VITE_GATEWAY_BASE_URL` se incrusta en el bundle y en la CSP de nginx, por lo
que depende del ALB. No hay variable manual: tras autenticarse en AWS, el
workflow lee el DNS del ALB `security-app-alb`
(`aws elbv2 describe-load-balancers`) y construye con
`https://<dns>:8080` (el mismo valor que el output de Terraform
`gateway_public_url`). Si no puede resolverlo, el deploy falla con un error
claro. Si el ALB se recrea (cambia su DNS), vuelve a lanzar el deploy para
reconstruir la imagen con la URL nueva.

Requisitos en GitHub (Learner Lab no tiene OIDC; los fija
`scripts/refresh-gh-secrets.sh` del repo `infra`):

| Nombre | Tipo | Quién lo define |
|--------|------|-----------------|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | secrets del repo | `infra` `scripts/refresh-gh-secrets.sh` |
| `AWS_REGION` | variable del repo | `infra` `scripts/refresh-gh-secrets.sh` |

Las credenciales de Learner Lab caducan: si el deploy falla al autenticarse,
ejecuta `scripts/refresh-gh-secrets.sh` en `infra` y vuelve a lanzar el workflow.

### Redeploy manual y rollback

- Redeploy: pestaña Actions, workflow **Deploy**, **Run workflow**
  (`workflow_dispatch`).
- Rollback: lanza **Run workflow** eligiendo la ref (rama o tag) de un commit
  anterior, que reconstruye y despliega esa imagen; o, sin reconstruir,
  `aws ecs update-service --cluster security-app-cluster-v2 --service front --task-definition <familia>:<revisión anterior>`.

## Desarrollo asistido por IA

El repositorio se trabaja con [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai)
y Engram (memoria persistente). El flujo es Organic Driven Development: los
planes de trabajo sustanciales viven en `odd/tasks/<feature>.md` (con espejo
en Engram bajo `odd/<feature>/tasks`) y se cierran tarea por tarea con
commits convencionales. Las skills de terceros están en `.agents/skills/`
(fijadas en `skills-lock.json`) y el registro de skills en `.atl/`.
