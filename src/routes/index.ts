/**
 * Routing of the app (docs/architecture.md, layer 7): header and the three
 * authenticated sections (feature `sectioned-navigation`).
 */

export { AppHeader } from "./AppHeader";
export { AuthenticatedRoutes } from "./AuthenticatedRoutes";
export { SECTION_PATHS, sectionOf } from "./paths";
export type { SectionKey } from "./paths";
