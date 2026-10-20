/**
 * Única fuente de la URL base del Gateway (ver docs/architecture.md, capa
 * `src/api`; docs/security-scope.md: nunca hardcodear ni apuntar a un
 * microservicio interno). Se lee de `VITE_GATEWAY_BASE_URL`, inyectada en
 * build time por Vite — nunca un literal en el código.
 */

let overriddenBaseUrl: string | undefined;

/**
 * Permite sustituir la URL base en tests (unitarios contra el servidor de
 * contrato en un puerto efímero, o e2e contra el mismo servidor en
 * proceso) sin depender de recompilar con una variable de entorno de Vite
 * distinta por cada puerto aleatorio. Nunca se llama desde código de
 * producción real (`src/main.tsx` confía en el valor de build).
 */
export function configureGatewayBaseUrl(url: string | undefined): void {
  overriddenBaseUrl = url;
}

export function gatewayBaseUrl(): string {
  if (overriddenBaseUrl !== undefined) {
    return overriddenBaseUrl;
  }
  const fromBuildConfig = import.meta.env.VITE_GATEWAY_BASE_URL;
  if (!fromBuildConfig) {
    throw new Error(
      "VITE_GATEWAY_BASE_URL no está configurada (ver docs/architecture.md, " +
        "capa src/api) — define esta variable de entorno de Vite antes de compilar.",
    );
  }
  return fromBuildConfig;
}
