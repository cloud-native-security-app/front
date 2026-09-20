#!/usr/bin/env bash
# init.sh — Verificación e inicialización del entorno
#
# Este script lo ejecuta el agente al COMENZAR una sesión y antes de
# declarar cualquier tarea como `done`. Si falla, la sesión no debe avanzar.
#
# Salida esperada: códigos de salida claros y bloques marcados con [OK]/[FAIL].

set -u
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$1"; }

EXIT_CODE=0

echo "── 1. Verificando entorno ─────────────────────────────"

if ! command -v node >/dev/null 2>&1; then
  fail "node no está instalado"
  exit 1
fi
ok "node -> $(node --version)"

if ! command -v npm >/dev/null 2>&1; then
  fail "npm no está instalado"
  exit 1
fi
ok "npm -> $(npm --version)"

echo ""
echo "── 2. Verificando archivos base del arnés ──────────────"

for f in AGENTS.md feature_list.json progress/current.md docs/architecture.md docs/conventions.md docs/verification.md docs/security-scope.md CHECKPOINTS.md; do
  if [ ! -f "$f" ]; then
    fail "Falta archivo base: $f"
    EXIT_CODE=1
  else
    ok "Existe $f"
  fi
done

echo ""
echo "── 3. Validando feature_list.json ──────────────────────"

if command -v jq >/dev/null 2>&1; then
  IN_PROGRESS_COUNT=$(jq '[.features[] | select(.status == "in_progress")] | length' feature_list.json)
  INVALID_STATUS_COUNT=$(jq '[.features[] | select(.status as $s | ["pending","in_progress","done","blocked"] | index($s) | not)] | length' feature_list.json)
  TOTAL=$(jq '.features | length' feature_list.json)

  if [ "$IN_PROGRESS_COUNT" -gt 1 ]; then
    fail "Hay $IN_PROGRESS_COUNT features en in_progress (máximo 1)"
    EXIT_CODE=1
  elif [ "$INVALID_STATUS_COUNT" -gt 0 ]; then
    fail "Hay $INVALID_STATUS_COUNT feature(s) con estado inválido"
    EXIT_CODE=1
  else
    ok "feature_list.json válido ($TOTAL features)"
  fi
else
  warn "jq no está instalado — se omite la validación de feature_list.json"
fi

echo ""
echo "── 4. Compilando, probando y verificando estilo del proyecto ─────"

if [ ! -f "package.json" ]; then
  warn "package.json no existe todavía — scaffolding pendiente (ver feature 'scaffolding')"
else
  if [ ! -d "node_modules" ]; then
    warn "node_modules no existe — ejecutando npm ci"
    if ! npm ci 2>&1; then
      fail "npm ci falló"
      EXIT_CODE=1
    fi
  fi

  if npm run format:check --if-present 2>&1; then
    ok "prettier --check sin diferencias"
  else
    fail "prettier --check encontró diferencias de formato"
    EXIT_CODE=1
  fi

  if npm run lint --if-present 2>&1; then
    ok "eslint sin warnings"
  else
    fail "eslint encontró warnings/errores"
    EXIT_CODE=1
  fi

  if npm run typecheck --if-present 2>&1; then
    ok "tsc --noEmit sin errores de tipos"
  else
    fail "tsc encontró errores de tipos"
    EXIT_CODE=1
  fi

  if npm run test --if-present -- --run 2>&1; then
    ok "Tests unitarios/de componente (vitest) pasan"
  else
    fail "Hay tests unitarios/de componente rotos"
    EXIT_CODE=1
  fi

  # `build` corre antes que `test:e2e` a propósito: el `webServer` de
  # Playwright sirve `dist/` vía `vite preview`, así que un `test:e2e`
  # ejecutado contra una build vieja/inexistente daría una falsa sensación
  # de verde (o un fallo por `dist/` desactualizado en vez de por el
  # código fuente actual).
  if npm run build --if-present 2>&1; then
    ok "npm run build (vite) genera sin errores"
  else
    fail "npm run build falló"
    EXIT_CODE=1
  fi

  if npm run test:e2e --if-present 2>&1; then
    ok "Tests end-to-end (playwright) pasan o no hay ninguno todavía"
  else
    fail "Hay tests end-to-end (playwright) rotos, o falta 'npx playwright install'. Si es por navegadores no instalados, documenta el bloqueo en progress/current.md (ver docs/verification.md) — no los reemplaces por mocks."
    EXIT_CODE=1
  fi
fi

echo ""
echo "── 5. Resumen ──────────────────────────────────────────"

if [ $EXIT_CODE -eq 0 ]; then
  ok "Entorno listo. Puedes empezar a trabajar."
else
  fail "Entorno NO está listo. Resuelve los errores antes de avanzar."
fi

exit $EXIT_CODE
