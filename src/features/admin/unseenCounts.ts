/**
 * Pure unseen-items counter behind the admin tab badges (AP-10). A tab that
 * is not selected counts the ids that appeared in its list since the tab was
 * last selected. An id counts as new when it was not in the previously seen
 * list, so a fresh snapshot after a reconnect (same items, new arrays) adds
 * nothing, and removals (a finished scan) never count.
 */

export type AdminTabId = "scans" | "findings" | "events";

export const ADMIN_TAB_IDS: readonly AdminTabId[] = [
  "scans",
  "findings",
  "events",
];

export type TabIds = Record<AdminTabId, readonly string[]>;

export interface UnseenState {
  selected: AdminTabId;
  /** The id lists last processed (compared by reference to skip no-ops). */
  ids: TabIds;
  counts: Record<AdminTabId, number>;
}

export function initialUnseen(selected: AdminTabId, ids: TabIds): UnseenState {
  return {
    selected,
    ids,
    counts: { scans: 0, findings: 0, events: 0 },
  };
}

/**
 * Next state for the current id lists and selected tab. Returns `state`
 * itself when nothing changed, so callers can compare by reference.
 */
export function advanceUnseen(
  state: UnseenState,
  ids: TabIds,
  selected: AdminTabId,
): UnseenState {
  const changed = ADMIN_TAB_IDS.filter((tab) => ids[tab] !== state.ids[tab]);
  if (changed.length === 0 && selected === state.selected) {
    return state;
  }
  const counts = { ...state.counts };
  for (const tab of changed) {
    const known = new Set(state.ids[tab]);
    const added = ids[tab].filter((id) => !known.has(id)).length;
    counts[tab] += added;
  }
  counts[selected] = 0;
  return { selected, ids, counts };
}
