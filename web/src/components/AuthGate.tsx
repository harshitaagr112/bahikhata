"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";

function isPublicPath(pathname: string | null) {
  return pathname === "/login";
}

/** Client-side auth check — every page except /login requires a valid
 * session. The /api/me check runs once per app load, and again whenever we
 * navigate while not yet confirmed authenticated (e.g. right after login
 * redirects away from /login) — but never again once confirmed true, so
 * re-checking doesn't blank the screen on every sidebar click. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (authenticated === true) return;
    getMe()
      .then((res) => setAuthenticated(res.authenticated))
      .catch(() => setAuthenticated(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (authenticated === false && !isPublicPath(pathname)) {
      router.replace("/login");
    }
  }, [authenticated, pathname, router]);

  if (!isPublicPath(pathname) && authenticated !== true) {
    return null;
  }

  return <>{children}</>;
}
