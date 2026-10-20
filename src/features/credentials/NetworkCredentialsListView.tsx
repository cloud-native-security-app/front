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
 */

import type { NetworkCredential } from "../../api";

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
  if (entries.length === 0) {
    return (
      <p role="status">Todavía no hay credenciales de red configuradas.</p>
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
                <button
                  type="button"
                  aria-label={`Borrar credencial de ${entry.target_pattern}`}
                  disabled={rowState.status === "deleting"}
                  onClick={() => onDelete(entry.id)}
                >
                  {rowState.status === "deleting" ? "Borrando…" : "Borrar"}
                </button>
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
