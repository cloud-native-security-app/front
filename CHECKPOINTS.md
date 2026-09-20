# CHECKPOINTS — Evaluación del estado final

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) puede usar
> para decidir si el proyecto está sano.

## C1 — El arnés está completo

- [ ] Existen los 4 archivos base: `AGENTS.md`, `init.sh`, `feature_list.json`,
      `progress/current.md`.
- [ ] Existen los 4 docs: `docs/architecture.md`, `docs/conventions.md`,
      `docs/verification.md`, `docs/security-scope.md`.
- [ ] `./init.sh` termina con exit code 0.

## C2 — El estado es coherente

- [ ] Como mucho una feature en `in_progress` en `feature_list.json`.
- [ ] Toda feature `done` tiene tests asociados que pasan.
- [ ] `progress/current.md` está vacío o describe la sesión activa
      (no contiene basura de sesiones anteriores).

## C3 — El código respeta la arquitectura

- [ ] `src/` solo contiene las carpetas previstas en `docs/architecture.md`
      (`api`, `auth`, `features`, `components`, `routes`).
- [ ] Toda dependencia nueva en `package.json` está justificada por una
      feature de `feature_list.json` o por `docs/architecture.md`.
- [ ] No hay `console.log` sueltos de debug, ni `any`/`@ts-ignore` sin
      justificar, ni TODOs sin contexto.
- [ ] `npm run typecheck` y `npm run lint` no muestran errores/warnings.

## C4 — La verificación es real

- [ ] `tests/` tiene al menos un test por lógica pura o componente con
      comportamiento propio.
- [ ] `e2e/` tiene al menos un test end-to-end por flujo de usuario completo
      (login, nueva solicitud, tiempo real, histórico, cancelación, reporte),
      corriendo contra el servidor de contrato real (nunca `vi.mock`/`msw`
      interceptando `fetch` a nivel de módulo — ver `docs/security-scope.md`
      y `docs/verification.md`).
- [ ] `npm run test` muestra > 0 tests y todos verdes.
- [ ] `npm run build` genera sin errores.

## C5 — La sesión se cerró bien

- [ ] No hay archivos sin trackear sospechosos (`*.tmp`, `dist/`/
      `node_modules/` fuera del `.gitignore`).
- [ ] `progress/history.md` tiene una entrada por la última sesión.
- [ ] La última feature trabajada está reflejada en su estado correcto.

---

**Cómo usar este archivo:** un agente revisor (`.claude/agents/reviewer.md`)
recorre cada checkbox, marca `[x]` o `[ ]`, y rechaza el cierre de sesión
si quedan boxes vacíos en C1-C5.
