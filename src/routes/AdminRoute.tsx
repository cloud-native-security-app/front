/**
 * Guard of the admin section (feature `admin-panel`). The role in the
 * session only decides what the UI shows; it is never authorization (the
 * Gateway answers 403 on `/api/admin/*`). A non-admin, or a session whose
 * role is unknown, is sent to the scan section before any admin data is
 * requested or rendered.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useSession } from "../auth";
import { SECTION_PATHS } from "./paths";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useSession();

  if (user?.role !== "admin") {
    return <Navigate to={SECTION_PATHS.scan} replace />;
  }
  return <>{children}</>;
}
