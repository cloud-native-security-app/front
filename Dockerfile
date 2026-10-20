# syntax=docker/dockerfile:1
#
# Imagen de producción de `front` (feature `containerization`).
#
# Multi-stage:
#   - builder: toolchain Node completa, corre `npm ci && npm run build`
#     (que ya incluye `tsc --noEmit`, ver package.json). Nunca llega al
#     runtime final.
#   - runtime: nginx-alpine mínimo, sirve únicamente `dist/`. Sin Node, sin
#     `node_modules`, sin código fuente ni toolchain — solo los assets
#     estáticos ya compilados y la configuración de nginx.
#
# `VITE_GATEWAY_BASE_URL` es obligatorio como build-arg: Vite lo hornea en
# el bundle JS en tiempo de build (`import.meta.env.VITE_*`, ver
# `src/api/config.ts`) — `front` nunca lo lee de una variable de entorno en
# runtime, porque en runtime ya es un bundle estático servido por nginx, no
# un proceso Node. El mismo valor también parametriza el `connect-src` de la
# Content-Security-Policy (`nginx.conf.template`), para que la CSP no
# bloquee las propias llamadas de `src/api` sin abrir la puerta a ningún
# otro origen (docs/security-scope.md).
#
# Ejemplo de build:
#   docker build --build-arg VITE_GATEWAY_BASE_URL=https://gateway.example.com -t front .
#
# Las imágenes base se fijan por tag concreto Y por digest (`@sha256:...`)
# para builds reproducibles. Al actualizar una base, refresca el digest con
# `docker buildx imagetools inspect <imagen:tag>`.

# ---------------------------------------------------------------------------
# Stage 1 — builder
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS builder

ARG VITE_GATEWAY_BASE_URL
RUN test -n "$VITE_GATEWAY_BASE_URL" || \
    (echo "VITE_GATEWAY_BASE_URL build-arg es obligatorio (ver docs/architecture.md)" >&2 && exit 1)

WORKDIR /app

# 1) Cachea la instalación de dependencias: mientras package.json/
#    package-lock.json no cambien, esta capa se reutiliza aunque cambie
#    src/.
COPY package.json package-lock.json ./
RUN npm ci

# 2) Copia el código real y compila. `npm run build` corre `tsc --noEmit`
#    antes de `vite build` (ver package.json) — un error de tipos rompe el
#    build de la imagen, no solo el de CI.
COPY . .
ENV VITE_GATEWAY_BASE_URL=${VITE_GATEWAY_BASE_URL}
RUN npm run build

# Genera la configuración final de nginx sustituyendo el placeholder por el
# mismo origen del Gateway ya horneado en el bundle JS (mismo build-arg,
# una sola fuente de verdad). `sed` en vez de `envsubst` porque esta imagen
# base no garantiza tener `gettext-base` instalado.
RUN sed "s|__GATEWAY_ORIGIN__|${VITE_GATEWAY_BASE_URL}|g" nginx.conf.template > nginx.conf

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

LABEL org.opencontainers.image.title="front" \
      org.opencontainers.image.description="SPA del analista (React+TypeScript+Vite): assets estáticos servidos por nginx" \
      org.opencontainers.image.source="https://github.com/o-aguirre/front"

COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# La imagen base ya trae un usuario/grupo `nginx` (uid/gid 101) sin
# privilegios; nos aseguramos de que sea dueño de todo lo que necesita
# escribir (pid file, caches, logs) y forzamos que el proceso corra como
# ese usuario, nunca como root (docs/security-scope.md).
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
