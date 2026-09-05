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
    let active = true;

    getMe()
      .then((res) => {
        if (!active) return;
        setAuthenticated(res.authenticated);
      })
      .catch(() => {
        if (!active) return;
        setAuthenticated(false);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") {
      if (authenticated === true) {
        router.replace("/");
      }
      return;
    }

    if (authenticated === false) {
      router.replace("/login");
    }
  }, [authenticated, pathname, router]);

  if (!isPublicPath(pathname) && authenticated !== true) {
    return null;
  }

  return <>{children}</>;
}
