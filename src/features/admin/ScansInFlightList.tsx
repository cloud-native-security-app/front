import type { AdminInFlightScan } from "../../api";
import {
  ADMIN_NO_SCANS_MESSAGE,
  ADMIN_SCANS_TITLE,
  ADMIN_SCAN_COLUMNS,
  ADMIN_SCAN_STATUS_LABEL,
} from "../../copy";
import { formatTime } from "./formatters";

export function ScansInFlightList({ scans }: { scans: AdminInFlightScan[] }) {
  return (
    <section aria-labelledby="admin-scans-title">
      <h3 id="admin-scans-title">{ADMIN_SCANS_TITLE}</h3>
      {scans.length === 0 ? (
        <p>{ADMIN_NO_SCANS_MESSAGE}</p>
      ) : (
        <table>
          <caption className="visually-hidden">{ADMIN_SCANS_TITLE}</caption>
          <thead>
            <tr>
              <th scope="col">{ADMIN_SCAN_COLUMNS.scan}</th>
              <th scope="col">{ADMIN_SCAN_COLUMNS.status}</th>
              <th scope="col">{ADMIN_SCAN_COLUMNS.since}</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.scan_id}>
                <td data-label={ADMIN_SCAN_COLUMNS.scan}>{scan.scan_id}</td>
                <td data-label={ADMIN_SCAN_COLUMNS.status}>
                  {ADMIN_SCAN_STATUS_LABEL[scan.status]}
                </td>
                <td data-label={ADMIN_SCAN_COLUMNS.since}>
                  <time dateTime={scan.since}>{formatTime(scan.since)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
