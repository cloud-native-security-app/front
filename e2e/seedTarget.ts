/**
 * Saves a network credential through the API of the contract server so a
 * scan can be started by picking the target (feature `sectioned-navigation`:
 * the scan form no longer accepts typed IPs). Not a spec file.
 */
import { expect, type BrowserContext } from "@playwright/test";

export async function seedTarget(
  context: BrowserContext,
  target: string,
): Promise<void> {
  const response = await context.request.post("/api/network-credentials", {
    data: {
      target_pattern: target,
      network_user: "root",
      ssh_credentials_ref: "vault://ssh/e2e-lab-key",
      has_sudo: false,
    },
  });
  expect(response.ok()).toBe(true);
}
