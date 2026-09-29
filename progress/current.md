# Sesión actual

> Este archivo se vacía al cerrar cada sesión y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** 14 — `no_store_fetch_cache`
- **Inicio:** 2026-09-29
- **Agente:** leader → implementer → reviewer

## Plan

Añadir `cache: "no-store"` al `fetch` de `performRequest`
(`src/api/httpClient.ts`), con un comentario breve: evita que un
`GET /api/me` con 200 cacheado haga parecer activa la sesión tras el logout.
Verificar con `npm run typecheck`, `npm run lint`, `npm run format:check` y
`npm test`. El usuario revisa el diff antes del commit (no se hace commit
en esta sesión).

## Bitácora

- La primera ejecución de `./init.sh` falló por dos problemas de entorno,
  ninguno del código:
  - `prettier --check` marcaba 104 archivos por CRLF (`core.autocrlf=true`
    y sin `.gitattributes`). Se arregló con `.gitattributes`
    (`* text=auto eol=lf`) y volviendo a sacar los archivos; commit
    `1e4e33b`.
  - Faltaba el Chromium de Playwright; se instaló con
    `npx playwright install chromium` (solo en esta máquina).
- **Problema conocido (ya existía antes de este cambio y no tiene relación
  con él):** dos tests de
  `tests/features/credentials/NetworkCredentialForm.test.tsx` fallan de
  forma intermitente por timeout (5 s por defecto de Vitest):
  `deshabilita_el_envio_mientras_falten_campos_requeridos` y
  `submit_exitoso_llama_a_onCreated_con_la_credencial_devuelta_y_limpia_el_formulario`
  (este último probablemente arrastrado por el primero). Causa:
  `userEvent.type` escribe letra por letra y, con la suite en paralelo,
  tarda más de 5 s. Pasan 3/3 veces con el archivo solo y fallan de forma
  intermitente en la suite completa. Decisión del usuario: no bloquea esta
  feature. Si fallan solo esos dos, se reejecuta y se anota cada
  ejecución. Se registra una feature `pending` aparte para estabilizarlos.

## Próximo paso

Lanzar el implementer de la feature 14.
- Implementer: se añadió `cache: "no-store"` en `src/api/httpClient.ts` y se creó el test
  `tests/api/httpClient.test.ts`. typecheck, lint, format:check y npm test pasan
  (1 ejecución, 131/131). Informe: `progress/impl_no_store_fetch_cache.md`.
  Pendiente de reviewer.
- Reviewer: `approved` (`progress/review_no_store_fetch_cache.md`).
- Verificación final del leader: typecheck, lint, format:check y `npm test`
  (131/131) en verde en la 1.ª ejecución. Se registró la feature 15
  (`pending`) para los tests intermitentes.
- **Siguiente:** el usuario revisa el diff. Después: commit, marcar la
  feature 14 como `done` y cerrar la sesión (vaciar este archivo).
