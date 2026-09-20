/**
 * Tests del validador puro de IP/CIDR (feature `scan_request_form`,
 * criterio 1 y 5): casos válidos e inválidos, con mensajes específicos por
 * tipo de fallo (nunca un genérico "inválido").
 */
import { describe, expect, it } from "vitest";

import { validateScanTarget } from "../../../src/features/scan/validateScanTarget";

describe("validateScanTarget", () => {
  it("acepta_una_ip_v4_valida", () => {
    expect(validateScanTarget("192.168.1.10")).toEqual({ valid: true });
  });

  it("acepta_un_rango_cidr_valido", () => {
    expect(validateScanTarget("10.0.0.0/24")).toEqual({ valid: true });
  });

  it("acepta_el_prefijo_cidr_maximo_32", () => {
    expect(validateScanTarget("10.0.0.1/32")).toEqual({ valid: true });
  });

  it("recorta_espacios_en_blanco_antes_de_validar", () => {
    expect(validateScanTarget("  192.168.1.10  ")).toEqual({ valid: true });
  });

  it("rechaza_una_entrada_vacia_con_mensaje_especifico", () => {
    const result = validateScanTarget("   ");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/ingresa una ip/i);
    }
  });

  it("rechaza_una_ip_con_menos_de_4_octetos_con_mensaje_de_formato", () => {
    const result = validateScanTarget("192.168.1");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/4 octetos/i);
    }
  });

  it("rechaza_un_octeto_fuera_de_rango_con_mensaje_especifico", () => {
    const result = validateScanTarget("192.168.1.256");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/fuera de rango/i);
      expect(result.message).toMatch(/256/);
    }
  });

  it("rechaza_un_octeto_no_numerico_con_mensaje_especifico", () => {
    const result = validateScanTarget("192.168.1.abc");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/octeto inválido/i);
    }
  });

  it("rechaza_mas_de_una_barra_con_mensaje_de_formato_cidr", () => {
    const result = validateScanTarget("10.0.0.0/24/1");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/formato cidr/i);
    }
  });

  it("rechaza_un_prefijo_cidr_no_numerico_con_mensaje_especifico", () => {
    const result = validateScanTarget("10.0.0.0/abc");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/prefijo cidr inválido/i);
    }
  });

  it("rechaza_un_prefijo_cidr_fuera_de_rango_con_mensaje_especifico", () => {
    const result = validateScanTarget("10.0.0.0/33");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toMatch(/prefijo cidr fuera de rango/i);
    }
  });

  it("mensajes_de_fallos_distintos_no_son_iguales_entre_si", () => {
    const emptyResult = validateScanTarget("");
    const octetResult = validateScanTarget("999.1.1.1");
    const prefixResult = validateScanTarget("10.0.0.0/99");

    if (emptyResult.valid || octetResult.valid || prefixResult.valid) {
      throw new Error("setup del test falló: se esperaban 3 casos inválidos");
    }
    expect(emptyResult.message).not.toBe(octetResult.message);
    expect(octetResult.message).not.toBe(prefixResult.message);
  });
});
