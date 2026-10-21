// Applies the persisted theme before first paint (feature
// `theme-and-contrast`). Classic external script because the CSP is
// `script-src 'self'` (no inline). Mirrors `src/theme/theme.ts`.
try {
  var choice = window.localStorage.getItem("theme");
  if (choice === "light" || choice === "dark") {
    document.documentElement.setAttribute("data-theme", choice);
  }
} catch (_error) {
  // Storage blocked: follow the OS preference.
}
