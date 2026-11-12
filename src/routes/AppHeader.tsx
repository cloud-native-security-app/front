/**
 * Authenticated header (feature `sectioned-navigation`, SNV-01; single row
 * since AP-01b): product name, section links (`NavLink` sets
 * `aria-current="page"` on the active one) and a menu button that discloses
 * the signed-in identity, the theme toggle and the logout. Below 640px the
 * links move into the same panel (CSS swaps which `<nav>` is displayed).
 */

import { useEffect, useId, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import { LogoutButton, useSession } from "../auth";
import {
  NAV_LABEL,
  PRODUCT_NAME,
  SECTION_ADMIN,
  SECTION_HISTORY,
  SECTION_SCAN,
  SECTION_TARGETS,
  USER_MENU_LABEL,
} from "../copy";
import { ThemeToggle } from "../theme";
import { SECTION_PATHS } from "./paths";

interface SectionLink {
  to: string;
  label: string;
}

const SECTION_LINKS: SectionLink[] = [
  { to: SECTION_PATHS.scan, label: SECTION_SCAN },
  { to: SECTION_PATHS.history, label: SECTION_HISTORY },
  { to: SECTION_PATHS.targets, label: SECTION_TARGETS },
];

function SectionNav({
  className,
  links,
}: {
  className: string;
  links: SectionLink[];
}) {
  return (
    <nav aria-label={NAV_LABEL} className={className}>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function AppHeader() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const links =
    user?.role === "admin"
      ? [...SECTION_LINKS, { to: SECTION_PATHS.admin, label: SECTION_ADMIN }]
      : SECTION_LINKS;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className="app-header">
      <h1>{PRODUCT_NAME}</h1>
      <SectionNav className="app-header__nav" links={links} />
      <div
        className="app-header__menu"
        ref={wrapperRef}
        onBlur={(event) => {
          // Tabbing out of the menu closes it.
          if (!wrapperRef.current?.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
      >
        <button
          type="button"
          ref={buttonRef}
          className="button--secondary app-header__menu-button"
          aria-label={USER_MENU_LABEL}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <MenuIcon />
        </button>
        <div
          id={panelId}
          className="app-header__panel"
          hidden={!open}
          onClick={(event) => {
            // Selecting a section link closes the menu.
            if ((event.target as Element).closest("a")) setOpen(false);
          }}
        >
          <SectionNav className="app-header__panel-nav" links={links} />
          {user && (
            <span className="app-header__identity">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </span>
          )}
          <div className="app-header__actions">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
