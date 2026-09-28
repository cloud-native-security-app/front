/**
 * Estado en memoria del servidor de contrato (ver `./server.ts` para el
 * porqué de este servidor). Vive solo mientras el proceso está arriba —
 * no hay persistencia, cada arranque (in-process en Vitest, o vía
 * `main.ts` para Playwright) empieza en blanco.
 */

import { randomUUID } from "node:crypto";

import type {
  CreateNetworkCredentialInput,
  MeResponse,
  NetworkCredential,
  ScanOutcomeEvent,
  ScanResult,
  ScanStatus,
} from "../../src/api/types";

export interface ScanRecord {
  scanId: string;
  sessionToken: string;
  target: string;
  status: ScanStatus;
  requestedAt: string;
  updatedAt: string;
  /** Guion de eventos SSE completo (incluye los ya emitidos). */
  script: ScanOutcomeEvent[];
  /** Índice del próximo evento del guion que falta emitir a algún suscriptor. */
  nextEventIndex: number;
  result: ScanResult | undefined;
  /**
   * Si es `true`, la próxima vez que alguien se suscriba a `/events` la
   * conexión se corta abruptamente (`res.destroy()`, no `res.end()`) justo
   * después del primer evento emitido en esa conexión — simula un corte de
   * red real para poder testear la reconexión automática de
   * `EventSource` (ver `progress/explore_sse_contract_server.md` §2.2).
   * Se consume una sola vez.
   */
  dropConnectionOnce: boolean;
}

/**
 * Registro interno de una credencial de red (feature
 * `network_credentials_manager`, id 9). `ssh_credentials_ref` se guarda
 * únicamente para que este servidor de contrato pueda existir con forma
 * completa — nunca se expone en `toNetworkCredential` ni en ninguna
 * respuesta HTTP, mismo criterio que `gateway`/`ms-usuarios` reales (ver
 * docs/security-scope.md).
 */
export interface NetworkCredentialRecord {
  id: string;
  sessionToken: string;
  userId: string;
  targetPattern: string;
  networkUser: string;
  sshCredentialsRef: string;
  hasSudo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContractServerStore {
  sessions: Map<string, MeResponse>;
  scans: Map<string, ScanRecord>;
  networkCredentials: Map<string, NetworkCredentialRecord>;
}

let syntheticUserCounter = 0;

export function createStore(): ContractServerStore {
  return {
    sessions: new Map(),
    scans: new Map(),
    networkCredentials: new Map(),
  };
}

/**
 * Crea una sesión sintética (nunca una cuenta real de Google, ver
 * docs/security-scope.md: "identidades sintéticas de laboratorio"). Usado
 * únicamente por el endpoint de test `POST /__test__/session`.
 */
export function createSyntheticSession(
  store: ContractServerStore,
  identity?: Partial<MeResponse>,
): { token: string; profile: MeResponse } {
  syntheticUserCounter += 1;
  const profile: MeResponse = {
    sub: identity?.sub ?? `test-user-${syntheticUserCounter}`,
    email: identity?.email ?? `test-user-${syntheticUserCounter}@example.test`,
    name: identity?.name ?? `Analista de prueba ${syntheticUserCounter}`,
  };
  const token = randomUUID();
  store.sessions.set(token, profile);
  return { token, profile };
}

function buildScanResult(target: string): ScanResult {
  return {
    host: target,
    ports: [
      {
        port: 22,
        protocol: "tcp",
        state: "open",
        service: "ssh",
        version: "OpenSSH 9.6",
        cpes: ["cpe:/a:openbsd:openssh:9.6"],
      },
      {
        port: 80,
        protocol: "tcp",
        state: "open",
        service: "http",
        version: null,
        cpes: [],
      },
    ],
    vulnerabilities: [
      {
        id: "CVE-2023-38408",
        severity: "high",
        description:
          "Vulnerabilidad simulada por el servidor de contrato (no es un hallazgo real).",
        nse_script: "ssh-vuln-cve-2023-38408",
        source: "nmap_nse",
        references: ["https://nvd.nist.gov/vuln/detail/CVE-2023-38408"],
      },
    ],
    scanned_at: new Date().toISOString(),
  };
}

/**
 * Convención del servidor de contrato (no del Gateway real) para decidir
 * el desenlace de un escaneo a partir del propio `target`, así los tests
 * pueden pedir un desenlace concreto sin necesitar un endpoint de
 * configuración aparte:
 * - `target` contiene "fail" (case-insensitive) → termina en `failed`.
 * - `target` contiene "disconnect" → se corta la conexión SSE una vez
 *   antes de completar el guion (para testear reconexión).
 * - cualquier otro target → termina en `completed`.
 */
function buildScript(target: string, scanId: string): ScanOutcomeEvent[] {
  const started: ScanOutcomeEvent = {
    status: "started",
    correlation_id: scanId,
  };
  if (target.toLowerCase().includes("fail")) {
    return [
      started,
      {
        status: "failed",
        correlation_id: scanId,
        reason: "objetivo inalcanzable (simulado por el servidor de contrato)",
      },
    ];
  }
  return [
    started,
    {
      status: "completed",
      correlation_id: scanId,
      result: buildScanResult(target),
    },
  ];
}

export function createScan(
  store: ContractServerStore,
  sessionToken: string,
  target: string,
): ScanRecord {
  const scanId = randomUUID();
  const now = new Date().toISOString();
  const script = buildScript(target, scanId);
  const record: ScanRecord = {
    scanId,
    sessionToken,
    target,
    status: "PENDIENTE",
    requestedAt: now,
    updatedAt: now,
    script,
    nextEventIndex: 0,
    result: undefined,
    dropConnectionOnce: target.toLowerCase().includes("disconnect"),
  };
  store.scans.set(scanId, record);
  return record;
}

export function findOwnedScan(
  store: ContractServerStore,
  scanId: string,
  sessionToken: string,
): ScanRecord | undefined {
  const record = store.scans.get(scanId);
  if (!record || record.sessionToken !== sessionToken) {
    return undefined;
  }
  return record;
}

/** Aplica el efecto de un evento del guion sobre el estado REST del scan (ver `progress/explore_gateway_contract.md`: histórico y SSE son vocabularios distintos, pero en este servidor de contrato se mantienen sincronizados). */
export function applyEventToRecord(
  record: ScanRecord,
  event: ScanOutcomeEvent,
): void {
  record.updatedAt = new Date().toISOString();
  if (event.status === "started") {
    record.status = "EN_PROGRESO";
  } else if (event.status === "completed") {
    record.status = "COMPLETADO";
    record.result = event.result;
  } else {
    record.status = "FALLIDO";
  }
}

/** Nunca incluye `sshCredentialsRef` — mismo contrato que expone `gateway` real (ver `src/api/types.ts::NetworkCredential`). */
export function toNetworkCredential(
  record: NetworkCredentialRecord,
): NetworkCredential {
  return {
    id: record.id,
    user_id: record.userId,
    target_pattern: record.targetPattern,
    network_user: record.networkUser,
    has_sudo: record.hasSudo,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function createNetworkCredential(
  store: ContractServerStore,
  sessionToken: string,
  input: CreateNetworkCredentialInput,
): NetworkCredentialRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  const record: NetworkCredentialRecord = {
    id,
    sessionToken,
    userId: store.sessions.get(sessionToken)?.sub ?? sessionToken,
    targetPattern: input.target_pattern,
    networkUser: input.network_user,
    sshCredentialsRef: input.ssh_credentials_ref,
    hasSudo: input.has_sudo,
    createdAt: now,
    updatedAt: now,
  };
  store.networkCredentials.set(id, record);
  return record;
}

export function listNetworkCredentials(
  store: ContractServerStore,
  sessionToken: string,
): NetworkCredentialRecord[] {
  return [...store.networkCredentials.values()].filter(
    (record) => record.sessionToken === sessionToken,
  );
}

export function findOwnedNetworkCredential(
  store: ContractServerStore,
  id: string,
  sessionToken: string,
): NetworkCredentialRecord | undefined {
  const record = store.networkCredentials.get(id);
  if (!record || record.sessionToken !== sessionToken) {
    return undefined;
  }
  return record;
}

/** Devuelve `true` si borró la entrada; `false` si no existía o era de otro usuario (el servidor responde `404` en ambos casos, nunca `403`, mismo criterio que `gateway`/`ms-usuarios` reales). */
export function deleteNetworkCredential(
  store: ContractServerStore,
  id: string,
  sessionToken: string,
): boolean {
  const record = findOwnedNetworkCredential(store, id, sessionToken);
  if (!record) {
    return false;
  }
  store.networkCredentials.delete(id);
  return true;
}
