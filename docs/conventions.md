# Convenciones de código

> Homogeneidad extrema. La IA predice mejor cuando el repositorio se parece
> a sí mismo en todas partes.

## Estilo TypeScript / React

- **TypeScript estricto:** `"strict": true` en `tsconfig.json`. Nada de
  `any` sin justificar con un comentario; preferir `unknown` + narrowing.
- **Formato:** `prettier` (configuración por defecto salvo que se documente
  lo contrario en `.prettierrc`).
- **Lints:** `eslint` (con los plugins de React/hooks/TypeScript) debe pasar
  sin advertencias — incluye el código de `tests/`/`e2e/`, no solo `src/`.
- **Componentes:** función + hooks, nunca clases. Un componente por
  archivo, nombre de archivo = nombre del componente (`ScanForm.tsx`).
- **Nada de `any` implícito ni `// @ts-ignore`** sin un comentario que
  explique por qué es necesario y qué se pierde al silenciarlo.
- **Sin `console.log` de depuración** en código que llega a `main`.
  `console.error`/`console.warn` deliberados para errores reales son
  aceptables si no incluyen datos personales o tokens.
- **JSDoc en la API pública de `src/api`** (qué hace la función, qué puede
  fallar) — mismo espíritu que el rustdoc obligatorio en los repos Rust de
  esta plataforma.

## Nombres

| Tipo                       | Convención        | Ejemplo                  |
|-----------------------------|-------------------|---------------------------|
| Componentes                | `PascalCase`      | `ScanForm.tsx`            |
| Hooks                      | `camelCase` con prefijo `use` | `useScanEvents.ts` |
| Funciones / variables      | `camelCase`       | `submitScan`              |
| Tipos / interfaces         | `PascalCase`      | `ScanHistoryEntry`        |
| Constantes                 | `UPPER_SNAKE`     | `DEFAULT_POLL_INTERVAL_MS` |
| Archivos que no son componentes | `camelCase` o `kebab-case`, consistente dentro de cada carpeta | `api/client.ts` |

## Estructura de un módulo

```ts
/**
 * Una línea describiendo el propósito del módulo.
 */

import { useState } from "react";

import type { ScanHistoryEntry } from "../domain/scan";

// tipos y lógica del módulo
```

- Imports: primero dependencias externas, luego imports internos con rutas
  relativas — cada grupo separado por una línea en blanco (orden que aplica
  `eslint-plugin-import`/`prettier`).

## Tests

- **Unitarios/de componente** (`tests/`, `vitest` + Testing Library):
  lógica pura (validación de IP/rango, formateo, reducers/hooks) y
  componentes en aislamiento (render + interacción del usuario, nunca
  snapshot ciego sin aserciones de contenido).
- **End-to-end** (`e2e/`, `playwright`): flujos completos en un navegador
  real, contra un servidor de contrato que implementa la misma forma de API
  que documenta el Gateway (ver `docs/verification.md` — el Gateway real
  vive en otro repo, aún no disponible para levantar en este).
- Nombres de test descriptivos:
  `rejects_invalid_ip_format_before_submitting`.

## Manejo de errores (ejemplo)

```ts
export type ApiError =
  | { kind: "network" }
  | { kind: "unauthorized" }
  | { kind: "validation"; message: string }
  | { kind: "unexpected"; status: number };
```

Los mensajes de error mostrados al usuario nunca incluyen detalles internos
del Gateway (stack traces, headers) ni tokens.

## Comentarios

Por defecto **no** se escriben. Solo se permiten cuando explican un *por qué*
no obvio (p. ej. workaround documentado, invariante sutil, restricción de
`docs/security-scope.md`). Los nombres deben hacer el resto.
