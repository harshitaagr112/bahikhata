"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { bumpNavDepth, recordVisitedPath } from "@/lib/returnTo";

/** Invisible — keeps returnTo.ts's "last non-transaction-flow page" up to
 * date on every navigation (so transaction forms know where to send the
 * user back to after a save/delete), and bumps the nav-depth counter the
 * global Escape-to-go-back shortcut uses to know whether there's actually
 * anywhere to go back to. */
export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordVisitedPath(pathname, window.location.search);
    bumpNavDepth();
  }, [pathname]);

  return null;
}
