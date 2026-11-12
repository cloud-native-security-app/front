import type { AdminInFlightScan } from "../../api";
import {
  ADMIN_NO_SCANS_MESSAGE,
  ADMIN_SCANS_REGION_LABEL,
  ADMIN_SCANS_TITLE,
  ADMIN_SCAN_COLUMNS,
  ADMIN_SCAN_STATUS_LABEL,
  adminHiddenScans,
} from "../../copy";
import { MAX_VISIBLE_SCANS, newestScans } from "./boundedLists";
import { formatTime } from "./formatters";

export function ScansInFlightList({
  scans,
  max = MAX_VISIBLE_SCANS,
}: {
  scans: AdminInFlightScan[];
  max?: number;
}) {
  const { shown, hidden } = newestScans(scans, max);
  return (
    <section aria-labelledby="admin-scans-title">
      <h3 id="admin-scans-title">{ADMIN_SCANS_TITLE}</h3>
      {scans.length === 0 ? (
        <p>{ADMIN_NO_SCANS_MESSAGE}</p>
      ) : (
        <>
          <div
            className="admin-region"
            role="region"
            tabIndex={0}
            aria-label={ADMIN_SCANS_REGION_LABEL}
          >
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
                {shown.map((scan) => (
                  <tr key={scan.scan_id}>
                    <td data-label={ADMIN_SCAN_COLUMNS.scan}>{scan.scan_id}</td>
                    <td data-label={ADMIN_SCAN_COLUMNS.status}>
                      {ADMIN_SCAN_STATUS_LABEL[scan.status]}
                    </td>
                    <td data-label={ADMIN_SCAN_COLUMNS.since}>
                      <time dateTime={scan.since}>
                        {formatTime(scan.since)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <p className="field-help admin-region__more">
              {adminHiddenScans(hidden)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
