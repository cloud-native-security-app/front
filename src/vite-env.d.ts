/// <reference types="vite/client" />

/**
 * Tipa `import.meta.env.VITE_GATEWAY_BASE_URL` como `string` en vez de
 * caer en el `any` por defecto de `ImportMetaEnv` (ver
 * docs/conventions.md: "nada de `any` sin justificar").
 */
interface ImportMetaEnv {
  readonly VITE_GATEWAY_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
