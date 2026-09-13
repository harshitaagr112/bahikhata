"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordVisitedPath } from "@/lib/returnTo";

/** Invisible — just keeps returnTo.ts's "last non-transaction-flow page"
 * up to date on every navigation, so transaction forms know where to send
 * the user back to after a save/delete. */
export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordVisitedPath(pathname, window.location.search);
  }, [pathname]);

  return null;
}
