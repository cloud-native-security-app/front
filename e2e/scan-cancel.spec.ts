/**
 * E2E of cancelling from the scan page (feature `scan-live-status`, SC-03).
 * Targets in 198.51.100.0/24 are "held" by the contract server: the stream
 * emits `started` and then waits, so the scan stays running until it is
 * cancelled (see `e2e/contract-server/store.ts`).
 */
import { expect, test } from "@playwright/test";

import { seedTarget } from "./seedTarget";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "scan-cancel-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("cancelar_desde_la_pagina_de_escaneo_muestra_cancelado", async ({
  page,
  context,
}) => {
  await seedTarget(context, "198.51.100.10");
  await page.goto("/");

  await page.getByLabel("Objetivo a escanear").selectOption("198.51.100.10");
  await page.getByRole("button", { name: "Escanear" }).click();

  const cancel = page.getByRole("button", { name: "Cancelar escaneo" });
  await expect(cancel).toBeVisible();
  await cancel.click();

  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  await expect(cancel).toHaveCount(0);
  await expect(page.getByText(/sin conexión/)).toHaveCount(0);
});
