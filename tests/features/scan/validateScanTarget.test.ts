/**
 * Tests del validador puro de IP única (features `scan_request_form` y
 * `user-facing-copy`): casos válidos e inválidos, con mensajes específicos por
 * tipo de fallo (nunca un genérico "inválido").
 */
import { describe, expect, it } from "vitest";

import { validateScanTarget } from "../../../src/features/scan/validateScanTarget";

describe("validateScanTarget", () => {
  it("acepta_una_ip_v4_valida", () => {
    expect(validateScanTarget("192.168.1.10")).toEqual({
      valid: true,
      target: "192.168.1.10",
    });
  });

  it("acepta_x_x_x_x_barra_32_y_lo_normaliza_a_la_ip_sola", () => {
    expect(validateScanTarget("10.0.0.1/32")).toEqual({
      valid: true,
      target: "10.0.0.1",
    });
  });

  it("recorta_espacios_en_blanco_antes_de_validar", () => {
    expect(validateScanTarget("  192.168.1.10  ")).toEqual({
      valid: true,
      target: "192.168.1.10",
    });
  });

  it("rechaza_cualquier_otro_prefijo_con_el_mensaje_de_unica_ip", () => {
    for (const input of ["10.0.0.0/24", "10.0.0.0/0", "10.0.0.0/31"]) {
      expect(validateScanTarget(input)).toEqual({
        valid: false,
        message: "Solo se admite una única IP (no rangos).",
      });
    }
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

  it("rechaza_mas_de_una_barra_o_un_prefijo_no_valido_con_mensaje_de_formato", () => {
    for (const input of ["10.0.0.0/24/1", "10.0.0.1/abc", "10.0.0.1/33"]) {
      const result = validateScanTarget(input);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.message).toMatch(/formato de ip inválido/i);
      }
    }
  });

  it("mensajes_de_fallos_distintos_no_son_iguales_entre_si", () => {
    const emptyResult = validateScanTarget("");
    const octetResult = validateScanTarget("999.1.1.1");
    const prefixResult = validateScanTarget("10.0.0.0/24");

    if (emptyResult.valid || octetResult.valid || prefixResult.valid) {
      throw new Error("setup del test falló: se esperaban 3 casos inválidos");
    }
    expect(emptyResult.message).not.toBe(octetResult.message);
    expect(octetResult.message).not.toBe(prefixResult.message);
  });
});
