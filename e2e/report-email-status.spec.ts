/**
 * E2E of the email status line on the report view (feature `report_email`,
 * EM-04): the status comes from the history entry of the scan and the address
 * from the signed-in account. The contract server derives the status from the
 * target: `172.16.62.*` failed, `172.16.63.*` disabled, `172.16.64.*` pending,
 * anything else sent.
 */
import { expect, test, type BrowserContext } from "@playwright/test";

const EMAIL = "report-email-e2e@example.test";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: EMAIL, name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

/** Queues a scan through the API and drains its SSE stream until it completes. */
async function completedScanId(
  context: BrowserContext,
  target: string,
): Promise<string> {
  const submit = await context.request.post("/api/scans", { data: { target } });
  expect(submit.ok()).toBe(true);
  const { scanId } = (await submit.json()) as { scanId: string };
  const events = await context.request.get(`/api/scans/${scanId}/events`);
  await events.text();
  return scanId;
}

test("a_sent_report_says_it_was_emailed_to_the_account", async ({
  page,
  context,
}) => {
  const scanId = await completedScanId(context, "172.16.61.7");
  await page.goto(`/historial/${scanId}`);

  await expect(
    page.getByRole("heading", { name: /reporte de 172\.16\.61\.7/i }),
  ).toBeVisible();
  await expect(page.getByText(`Informe enviado a ${EMAIL}`)).toBeVisible();
});

test("a_failed_delivery_says_the_report_could_not_be_emailed", async ({
  page,
  context,
}) => {
  const scanId = await completedScanId(context, "172.16.62.7");
  await page.goto(`/historial/${scanId}`);

  await expect(
    page.getByRole("heading", { name: /reporte de 172\.16\.62\.7/i }),
  ).toBeVisible();
  await expect(
    page.getByText("No se pudo enviar el informe por correo."),
  ).toBeVisible();
  await expect(page.getByText(/Informe enviado a/)).toHaveCount(0);
});
