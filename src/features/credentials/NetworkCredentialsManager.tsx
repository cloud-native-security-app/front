/**
 * Contenedor de gestión de credenciales de red (feature
 * `network_credentials_manager`, id 9): formulario de alta
 * (`NetworkCredentialForm`) + listado con borrado
 * (`NetworkCredentialsListView`), vía `listNetworkCredentials`/
 * `deleteNetworkCredential` de `src/api`. Se monta antes de `ScanForm` en
 * `App.tsx` — sin al menos una credencial configurada, `POST /api/scans`
 * siempre responde 422 en el Gateway real.
 *
 * Tras crear o borrar una credencial con éxito, se hace un **refetch
 * simple** del listado (mismo criterio que `HistoryTable` tras cancelar, ver
 * el comentario de cabecera de ese archivo) en vez de mutar el array local a
 * mano: mantiene una única fuente de verdad (la respuesta de
 * `listNetworkCredentials`).
 */

import { useEffect, useState } from "react";

import {
  deleteNetworkCredential,
  listNetworkCredentials,
  type ApiError,
  type NetworkCredential,
} from "../../api";
import {
  CREDENTIAL_SAVED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  networkErrorMessage,
  unexpectedErrorMessage,
} from "../../copy";
import { NetworkCredentialForm } from "./NetworkCredentialForm";
import {
  NetworkCredentialsListView,
  type RowDeleteState,
} from "./NetworkCredentialsListView";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; entries: NetworkCredential[] };

function describeListError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return networkErrorMessage("para cargar las credenciales");
    case "unauthorized":
      return SESSION_EXPIRED_MESSAGE;
    case "unexpected":
      return unexpectedErrorMessage("al cargar las credenciales");
    default:
      return unexpectedErrorMessage("al cargar las credenciales");
  }
}

function describeDeleteError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return networkErrorMessage("para borrar la credencial");
    case "unauthorized":
      return SESSION_EXPIRED_MESSAGE;
    case "not_found":
      return "La credencial ya no existe o no pertenece a tu sesión.";
    case "unexpected":
      return unexpectedErrorMessage("al borrar la credencial");
    default:
      return unexpectedErrorMessage("al borrar la credencial");
  }
}

function toListState(
  result: Awaited<ReturnType<typeof listNetworkCredentials>>,
): ListState {
  return result.ok
    ? { status: "loaded", entries: result.value }
    : { status: "error", message: describeListError(result.error) };
}

export function NetworkCredentialsManager() {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [savedNotice, setSavedNotice] = useState(false);
  const [rowStates, setRowStates] = useState<Record<string, RowDeleteState>>(
    {},
  );

  useEffect(() => {
    // Mismo patrón que `HistoryTable` (feature `scan_history`): la llamada
    // async se dispara dentro del efecto y el `setState` está guardado por
    // `active` para no actualizar tras el desmontaje.
    let active = true;
    void listNetworkCredentials().then((result) => {
      if (active) {
        setState(toListState(result));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  /** Drops stale row errors; rows still deleting are kept untouched. */
  function clearRowErrors(): void {
    setRowStates((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([, rowState]) => rowState.status !== "error",
        ),
      ),
    );
  }

  async function refresh(): Promise<void> {
    const result = await listNetworkCredentials();
    setState(toListState(result));
    if (result.ok) {
      clearRowErrors();
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setSavedNotice(false);
    setRowStates((previous) => ({
      ...previous,
      [id]: { status: "deleting" },
    }));
    try {
      const result = await deleteNetworkCredential(id);
      if (result.ok) {
        setRowStates((previous) => ({
          ...previous,
          [id]: { status: "idle" },
        }));
        clearRowErrors();
        await refresh();
      } else {
        setRowStates((previous) => ({
          ...previous,
          [id]: {
            status: "error",
            message: describeDeleteError(result.error),
          },
        }));
      }
    } catch {
      // Defensive: the API layer never rejects, but a row must never stay
      // on "Borrando…" if something unexpected throws.
      setRowStates((previous) => ({
        ...previous,
        [id]: {
          status: "error",
          message: describeDeleteError({ kind: "network" }),
        },
      }));
    }
  }

  return (
    <section aria-label="Credenciales de red">
      <h2>Credenciales de red</h2>
      <NetworkCredentialForm
        onCreated={() => {
          setSavedNotice(true);
          void refresh();
        }}
      />
      {savedNotice && (
        <p role="status" className="notice">
          <span>{CREDENTIAL_SAVED_MESSAGE}</span>
          <button
            type="button"
            className="button--secondary"
            onClick={() => setSavedNotice(false)}
          >
            Cerrar aviso
          </button>
        </p>
      )}
      {state.status === "loading" && (
        <p role="status" data-tone="neutral">
          Cargando credenciales…
        </p>
      )}
      {state.status === "error" && <p role="alert">{state.message}</p>}
      {state.status === "loaded" && (
        <NetworkCredentialsListView
          entries={state.entries}
          rowStates={rowStates}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
    </section>
  );
}
