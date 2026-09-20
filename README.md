# front

SPA (React + TypeScript + Vite) de una plataforma de ciberseguridad blue/red
team: la interfaz que usa el analista para autenticarse, solicitar un
escaneo, ver su estado en tiempo real, consultar su histórico y revisar el
reporte final.

Este repo implementa **únicamente** `front`. El Gateway, `ms-usuarios`,
`ms-nmap`, `ms-analisis` y el Broker viven en otros repos. `front` habla
**solo** con el Gateway — nunca directo con un microservicio interno, nunca
con el Identity Provider.

Stack: React + TypeScript + Vite, tests con `vitest` + Testing Library,
end-to-end con `playwright`, `eslint` + `prettier`.

## Desarrollo

El repositorio se desarrolla guiado por agentes de IA sobre un arnés
documental (`AGENTS.md`, `feature_list.json`, `docs/`, `CHECKPOINTS.md`),
igual que `broker`, `nmap-service` y `user-service`. Antes de tocar código,
lee `CLAUDE.md`.

## Despliegue

Pendiente — se documenta al implementar la feature `containerization` (ver
`feature_list.json`).
