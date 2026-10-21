/** URL paths of the three authenticated sections (feature `sectioned-navigation`). */
export const SECTION_PATHS = {
  scan: "/escanear",
  history: "/historial",
  targets: "/objetivos",
} as const;

export type SectionKey = keyof typeof SECTION_PATHS;

/** Section a pathname belongs to; anything unknown falls back to the scan section. */
export function sectionOf(pathname: string): SectionKey {
  const first = pathname.split("/")[1];
  if (first === "historial") {
    return "history";
  }
  if (first === "objetivos") {
    return "targets";
  }
  return "scan";
}
