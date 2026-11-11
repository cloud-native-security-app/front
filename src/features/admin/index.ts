/**
 * Admin real-time panel (feature `admin-panel`, docs/architecture.md layer
 * 3): reducer and data hook (container), presentational components.
 */

export {
  MAX_CRITICAL_FINDINGS,
  MAX_IN_FLIGHT,
  MAX_RECENT_EVENTS,
  adminReducer,
} from "./adminReducer";
export type { AdminAction, AdminState } from "./adminReducer";
export { useAdminFeed } from "./useAdminFeed";
export type { AdminFeed, AdminFeedStatus } from "./useAdminFeed";
export { AdminPanel } from "./AdminPanel";
export { AdminPanelView } from "./AdminPanelView";
