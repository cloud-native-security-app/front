/**
 * Configuración de vitest para tests unitarios/de componente (ver tests/).
 * Separada de vite.config.ts para no acoplar la config de build de
 * producción con la de test (docs/verification.md, Nivel 1).
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
