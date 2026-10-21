/**
 * Authenticated header (feature `sectioned-navigation`, SNV-01): product
 * name, section links (`NavLink` sets `aria-current="page"` on the active
 * one), the signed-in identity from the session and the compact logout.
 */

import { NavLink } from "react-router-dom";

import { LogoutButton, useSession } from "../auth";
import {
  NAV_LABEL,
  PRODUCT_NAME,
  SECTION_HISTORY,
  SECTION_SCAN,
  SECTION_TARGETS,
} from "../copy";
import { ThemeToggle } from "../theme";
import { SECTION_PATHS } from "./paths";

const SECTION_LINKS = [
  { to: SECTION_PATHS.scan, label: SECTION_SCAN },
  { to: SECTION_PATHS.history, label: SECTION_HISTORY },
  { to: SECTION_PATHS.targets, label: SECTION_TARGETS },
];

export function AppHeader() {
  const { user } = useSession();

  return (
    <header className="app-header">
      <h1>{PRODUCT_NAME}</h1>
      <nav aria-label={NAV_LABEL} className="app-header__nav">
        {SECTION_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="app-header__user">
        <ThemeToggle />
        {user && (
          <span className="app-header__identity">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
