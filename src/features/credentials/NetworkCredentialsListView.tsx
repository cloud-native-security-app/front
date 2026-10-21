/**
 * Renderizado puro del listado de credenciales de red (feature
 * `network_credentials_manager`, id 9): recibe las entradas ya cargadas y el
 * estado de borrado por fila como props, sin conocer `src/api` — mismo
 * criterio de separación que `HistoryTableView` (ver
 * `src/features/history/HistoryTableView.tsx`).
 *
 * Nunca renderiza `ssh_credentials_ref`: el tipo `NetworkCredential` de
 * `src/api/types.ts` ni siquiera tiene ese campo — el Gateway nunca lo
 * devuelve (ver docs/security-scope.md).
 *
 * Borrar pide una confirmación inline (feature `layout-and-forms`, LAF-05):
 * el id en confirmación es estado puramente visual, así que vive aquí y no
 * en el contenedor. El foco pasa a "Cancelar" (acción segura) al abrirla y
 * vuelve al botón "Borrar" al cancelar o con Escape.
 */

import { useRef, useState } from "react";

import type { NetworkCredential } from "../../api";
import {
  EMPTY_CREDENTIALS_MESSAGE,
  confirmDeleteCredentialMessage,
} from "../../copy";

export type RowDeleteState =
  | { status: "idle" }
  | { status: "deleting" }
  | { status: "error"; message: string };

export interface NetworkCredentialsListViewProps {
  entries: NetworkCredential[];
  rowStates: Record<string, RowDeleteState>;
  onDelete: (id: string) => void;
}

export function NetworkCredentialsListView({
  entries,
  rowStates,
  onDelete,
}: NetworkCredentialsListViewProps) {
  const [confirmingId, setConfirmingId] = useState<string | undefined>();
  const deleteButtons = useRef<Record<string, HTMLButtonElement | null>>({});

  function cancelConfirmation(id: string): void {
    setConfirmingId(undefined);
    // The delete button is re-rendered right after; focus it on the next tick.
    queueMicrotask(() => deleteButtons.current[id]?.focus());
  }

  if (entries.length === 0) {
    return (
      <p role="status" data-tone="neutral">
        {EMPTY_CREDENTIALS_MESSAGE}
      </p>
    );
  }

  return (
    <table>
      <caption>Credenciales de red</caption>
      <thead>
        <tr>
          <th scope="col">Objetivo</th>
          <th scope="col">Usuario de red</th>
          <th scope="col">Sudo</th>
          <th scope="col">Acción</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const rowState = rowStates[entry.id] ?? { status: "idle" as const };
          return (
            <tr key={entry.id}>
              <td>{entry.target_pattern}</td>
              <td>{entry.network_user}</td>
              <td>{entry.has_sudo ? "Sí" : "No"}</td>
              <td>
                {confirmingId === entry.id ? (
                  <div
                    role="group"
                    aria-label={`Confirmar borrado de ${entry.target_pattern}`}
                    className="confirm-delete"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        cancelConfirmation(entry.id);
                      }
                    }}
                  >
                    <span>
                      {confirmDeleteCredentialMessage(entry.target_pattern)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(undefined);
                        onDelete(entry.id);
                      }}
                    >
                      Sí, borrar
                    </button>
                    <button
                      type="button"
                      className="button--secondary"
                      autoFocus
                      onClick={() => cancelConfirmation(entry.id)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    ref={(node) => {
                      deleteButtons.current[entry.id] = node;
                    }}
                    aria-label={`Borrar credencial de ${entry.target_pattern}`}
                    disabled={rowState.status === "deleting"}
                    onClick={() => setConfirmingId(entry.id)}
                  >
                    {rowState.status === "deleting" ? "Borrando…" : "Borrar"}
                  </button>
                )}
                {rowState.status === "error" && (
                  <p role="alert">{rowState.message}</p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
