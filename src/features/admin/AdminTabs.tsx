/**
 * Horizontal tabs (WAI-ARIA tabs pattern, automatic activation): roving
 * tabindex, ArrowLeft/ArrowRight (wrapping), Home and End. Every panel stays
 * mounted and only the inactive ones get `hidden`, so each keeps its scroll
 * position and local state (the log's pause and filter). A non-selected tab
 * shows how many unseen items it holds; its accessible name includes it.
 */

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { adminUnseenBadge, adminUnseenSuffix } from "../../copy";

export interface AdminTabDefinition {
  id: string;
  label: string;
  /** Unseen items; ignored for the selected tab. */
  unseen: number;
  panel: ReactNode;
}

export function AdminTabs({
  label,
  tabs,
  selected,
  onSelect,
}: {
  /** Accessible name of the tablist. */
  label: string;
  tabs: AdminTabDefinition[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const baseId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  const activate = (index: number) => {
    const target = tabs[(index + tabs.length) % tabs.length];
    if (!target) {
      return;
    }
    onSelect(target.id);
    buttons.current.get(target.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case "ArrowRight":
        activate(index + 1);
        break;
      case "ArrowLeft":
        activate(index - 1);
        break;
      case "Home":
        activate(0);
        break;
      case "End":
        activate(tabs.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className="admin-tabs">
      <div role="tablist" aria-label={label} className="admin-tabs__list">
        {tabs.map((tab, index) => {
          const isSelected = tab.id === selected;
          const unseen = isSelected ? 0 : tab.unseen;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) {
                  buttons.current.set(tab.id, node);
                } else {
                  buttons.current.delete(tab.id);
                }
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              className="admin-tabs__tab"
              aria-selected={isSelected}
              aria-controls={panelId(tab.id)}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => {
                onSelect(tab.id);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
            >
              {tab.label}
              {unseen > 0 && (
                <span className="admin-tabs__badge">
                  <span aria-hidden="true">{adminUnseenBadge(unseen)}</span>
                  <span className="admin-tabs__badge-spoken">
                    {adminUnseenSuffix(unseen)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          hidden={tab.id !== selected}
          className="admin-tabs__panel"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
