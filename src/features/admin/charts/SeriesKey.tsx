/**
 * Mark that keys a series in the legend and the tooltip: a plain swatch, or an
 * icon for status series (so a status color never carries meaning alone). The
 * color comes from the `chart-tone--*` class of the parent through
 * `currentColor`-free CSS (`.chart-key`).
 */

export type SeriesIcon = "check" | "cross" | "triangle" | "diamond";

export function SeriesKey({ icon }: { icon?: SeriesIcon | undefined }) {
  return (
    <svg
      className="chart-key"
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      {icon === "check" ? (
        <path className="chart-key__stroke" d="M2 6.5l2.6 2.6L10 3.2" />
      ) : icon === "cross" ? (
        <path className="chart-key__stroke" d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
      ) : icon === "triangle" ? (
        <path className="chart-key__fill" d="M6 1.2l5 9H1z" />
      ) : icon === "diamond" ? (
        <path className="chart-key__fill" d="M6 .8l5.2 5.2L6 11.2.8 6z" />
      ) : (
        <rect
          className="chart-key__fill"
          x="1"
          y="1"
          width="10"
          height="10"
          rx="2"
        />
      )}
    </svg>
  );
}
