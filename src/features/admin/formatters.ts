/** Small display helpers of the admin panel. */

const numberFormat = new Intl.NumberFormat("es", {
  maximumFractionDigits: 1,
});

/** `0.125` -> `12,5 %`; `null` (no scans in the window) -> an em dash. */
export function formatFailureRate(rate: number | null): string {
  return rate === null ? "—" : `${numberFormat.format(rate * 100)} %`;
}

export function formatTime(isoDate: string): string {
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? isoDate : parsed.toLocaleTimeString();
}

/** `HH:MM` (24 h, local time) of an ISO minute, for chart axes and tables. */
export function formatMinuteLabel(minute: string): string {
  const date = new Date(minute);
  if (Number.isNaN(date.getTime())) {
    return minute;
  }
  return date.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
