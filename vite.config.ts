/**
 * Configuración de build/dev-server de Vite (ver docs/architecture.md).
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
