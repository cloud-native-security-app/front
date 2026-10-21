import type { ScanStatus } from "../../api";
import { SCAN_STATUS_LABEL } from "./scanStatus";

/** Small badge with the user-facing label; colors live in `src/index.css`. */
export function ScanStatusBadge({ status }: { status: ScanStatus }) {
  return (
    <span className="status-badge" data-status={status}>
      {SCAN_STATUS_LABEL[status]}
    </span>
  );
}
