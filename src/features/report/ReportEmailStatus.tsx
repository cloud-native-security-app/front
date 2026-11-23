/**
 * Presentational line telling whether the report of a completed scan was
 * emailed to the account. The status comes from the history entry; an absent
 * or unknown status renders nothing.
 */

import type { EmailStatus } from "../../api";
import {
  REPORT_EMAIL_DISABLED_MESSAGE,
  REPORT_EMAIL_FAILED_MESSAGE,
  reportEmailPendingMessage,
  reportEmailSentMessage,
} from "../../copy";

export interface ReportEmailStatusProps {
  status?: EmailStatus;
  /** Email of the signed-in account; unknown when there is no session data. */
  email?: string;
  /** RFC 3339 instant of the delivery (only with `sent`). */
  emailedAt?: string;
}

function formatEmailedAt(isoDate: string | undefined): string | undefined {
  if (isoDate === undefined) {
    return undefined;
  }
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? isoDate : parsed.toLocaleString();
}

function messageFor({
  status,
  email,
  emailedAt,
}: ReportEmailStatusProps): string | undefined {
  switch (status) {
    case "sent":
      return reportEmailSentMessage(email, formatEmailedAt(emailedAt));
    case "pending":
      return reportEmailPendingMessage(email);
    case "failed":
      return REPORT_EMAIL_FAILED_MESSAGE;
    case "disabled":
      return REPORT_EMAIL_DISABLED_MESSAGE;
    default:
      return undefined;
  }
}

export function ReportEmailStatus(props: ReportEmailStatusProps) {
  const message = messageFor(props);
  if (message === undefined) {
    return null;
  }
  return <p role="status">{message}</p>;
}
