/**
 * Raw event log (the Gateway keeps the last 100): a native `<select>` filters
 * by event type, so it is keyboard- and screen-reader-usable for free. The
 * payload is shown as the Gateway sent it; `actor_sub` is never rendered.
 */

import { useId, useState } from "react";

import type { AdminEventEntry } from "../../api";
import {
  ADMIN_ALL_EVENT_TYPES_LABEL,
  ADMIN_EVENTS_TITLE,
  ADMIN_EVENT_COLUMNS,
  ADMIN_EVENT_DETAIL_LABEL,
  ADMIN_EVENT_FILTER_LABEL,
  ADMIN_NO_EVENTS_FOR_FILTER_MESSAGE,
  ADMIN_NO_EVENTS_MESSAGE,
  adminEventCount,
} from "../../copy";
import { formatTime } from "./formatters";

export function EventLog({ events }: { events: AdminEventEntry[] }) {
  const [filter, setFilter] = useState("");
  const selectId = useId();
  const titleId = useId();

  const types = [...new Set(events.map((event) => event.event_type))].sort();
  // Keep the chosen type selectable even if its events rolled out of the log.
  if (filter !== "" && !types.includes(filter)) {
    types.push(filter);
  }
  const visible =
    filter === "" ? events : events.filter((e) => e.event_type === filter);

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>{ADMIN_EVENTS_TITLE}</h3>
      {events.length === 0 ? (
        <p>{ADMIN_NO_EVENTS_MESSAGE}</p>
      ) : (
        <>
          <div className="event-log__filter">
            <label htmlFor={selectId}>{ADMIN_EVENT_FILTER_LABEL}</label>
            <select
              id={selectId}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
            >
              <option value="">{ADMIN_ALL_EVENT_TYPES_LABEL}</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <span className="field-help">
              {adminEventCount(visible.length, events.length)}
            </span>
          </div>
          {visible.length === 0 ? (
            <p>{ADMIN_NO_EVENTS_FOR_FILTER_MESSAGE}</p>
          ) : (
            <table>
              <caption className="visually-hidden">
                {ADMIN_EVENTS_TITLE}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{ADMIN_EVENT_COLUMNS.time}</th>
                  <th scope="col">{ADMIN_EVENT_COLUMNS.type}</th>
                  <th scope="col">{ADMIN_EVENT_COLUMNS.source}</th>
                  <th scope="col">{ADMIN_EVENT_COLUMNS.scan}</th>
                  <th scope="col">{ADMIN_EVENT_COLUMNS.detail}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((event) => (
                  <tr key={event.event_id}>
                    <td data-label={ADMIN_EVENT_COLUMNS.time}>
                      <time dateTime={event.occurred_at}>
                        {formatTime(event.occurred_at)}
                      </time>
                    </td>
                    <td data-label={ADMIN_EVENT_COLUMNS.type}>
                      {event.event_type}
                    </td>
                    <td data-label={ADMIN_EVENT_COLUMNS.source}>
                      {event.source}
                    </td>
                    <td data-label={ADMIN_EVENT_COLUMNS.scan}>
                      {event.scan_id ?? "—"}
                    </td>
                    <td data-label={ADMIN_EVENT_COLUMNS.detail}>
                      <details>
                        <summary>{ADMIN_EVENT_DETAIL_LABEL}</summary>
                        <pre className="event-log__payload">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
