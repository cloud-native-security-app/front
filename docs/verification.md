# Verificación — Cómo demostrar que el trabajo funciona

> Regla de oro: **el agente no dice "funciona", lo demuestra**.
> Toda feature termina con evidencia ejecutable, no con afirmaciones.

## Niveles de verificación

### Nivel 0 — Tipos y estilo (obligatorio)

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format:check # prettier --check
```

Ningún warning de `eslint` se ignora en silencio; si es un falso positivo,
se documenta con un comentario `eslint-disable-next-line` explicando por qué.

### Nivel 1 — Tests unitarios y de componente (obligatorio)

Toda función pura (`src/domain`, validadores) y todo componente con lógica
propia tiene al menos un test que:

1. Cubre el camino feliz.
2. Cubre al menos un camino de error/estado vacío si aplica.

Comando:
```bash
npm run test
```

### Nivel 2 — Tests end-to-end (obligatorio para flujos de usuario completos)

- Los flujos de usuario completos (login → nueva solicitud → ver estado en
  tiempo real → histórico → cancelar → ver reporte) se prueban con
  `playwright` contra un **servidor de contrato**: un servidor HTTP/SSE
  local mínimo que implementa exactamente la forma de API que documenta
  `src/api` (mismos endpoints, mismos códigos de estado, mismo formato de
  evento SSE) — no un mock a nivel de módulo de JavaScript
  (`vi.mock`/`msw` interceptando `fetch`), sino un proceso real
  escuchando en un puerto, para que el test ejerza la capa de red de
  verdad. El Gateway real vive en otro repo (aún no disponible para
  levantar aquí vía `testcontainers` o similar); este servidor de contrato
  es la aproximación más real posible hasta que exista, y se documenta
  explícitamente como provisional en el código que lo define.
- Ningún test e2e depende de una cuenta real de Google ni de un Gateway de
  staging/producción.
- Comando:
```bash
npx playwright test
```
- Requiere `npx playwright install` (navegadores) al menos una vez por
  entorno. Si el entorno no tiene navegadores instalados, se documenta como
  bloqueo en `progress/current.md` — no se reemplaza por más mocks de
  `vitest`.

### Nivel 3 — Build de producción (obligatorio)

```bash
npm run build
```

Un `npm run build` roto (errores de tipos, imports inválidos) es motivo de
`CHANGES_REQUESTED`, no un detalle a arreglar "después".

## Anti-patrones (no hacer)

- ❌ "Añadí el formulario, debería funcionar." → falta test ejecutable con
  interacción real del usuario (Testing Library `userEvent`, no
  `fireEvent` crudo salvo necesidad concreta).
- ❌ Test que solo verifica que el componente "no crashea". → tiene que
  comprobar contenido/estado concreto.
- ❌ Mockear `src/api` en un test e2e en vez de usar el servidor de
  contrato real.
- ❌ Silenciar un error de `eslint`/`tsc` con un comentario sin explicación.
- ❌ Marcar la feature como `done` sin pasar `./init.sh`.

## Verificación final antes de cerrar

```bash
./init.sh           # debe terminar con [OK] Entorno listo
```

Si `./init.sh` está rojo, **no** marques nada como `done`. Anota el bloqueo
en `progress/current.md` y pon `"status": "blocked"` en `feature_list.json`.
