/**
 * Non-blocking notification when the tracked scan reaches a terminal state
 * (feature `keyboard-and-live-feedback`, KLF-04). Mounted once under
 * `ScanActivityProvider` (inside the Router) so it shows in any section. The
 * polite live region is always rendered so assistive tech announces the
 * content when it appears. Each finished scan id is announced once; closing
 * it hides it for that id, a new finished id shows again. The report link is
 * offered only when there is a report (`COMPLETADO`).
 */

import { useState } from "react";
import { Link } from "react-router-dom";

import {
  SCAN_NOTICE_DISMISS_LABEL,
  SCAN_NOTICE_VIEW_REPORT_LABEL,
  scanFinishedMessage,
} from "../../copy";
import { SECTION_PATHS } from "../../routes/paths";
import { useScanActivity } from "./scanActivityContext";

export function ScanFinishedNotice() {
  const { finishedScanId, status, target } = useScanActivity();
  const [dismissedId, setDismissedId] = useState<string | undefined>(undefined);

  const outcome =
    status === "COMPLETADO" || status === "FALLIDO" || status === "CANCELADO"
      ? status
      : undefined;
  const visible =
    finishedScanId !== undefined &&
    finishedScanId !== dismissedId &&
    outcome !== undefined;

  return (
    <div role="status" aria-live="polite" className="scan-notice-region">
      {visible && outcome && (
        <div className="scan-notice">
          <span>{scanFinishedMessage(outcome, target)}</span>
          {outcome === "COMPLETADO" && (
            <>
              {" — "}
              <Link to={`${SECTION_PATHS.history}/${finishedScanId}`}>
                {SCAN_NOTICE_VIEW_REPORT_LABEL}
              </Link>
            </>
          )}
          <button type="button" onClick={() => setDismissedId(finishedScanId)}>
            {SCAN_NOTICE_DISMISS_LABEL}
          </button>
        </div>
      )}
    </div>
  );
}
