"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpenCheck, LogOut, Menu, Plus, X } from "lucide-react";
import { logout } from "@/lib/api";
import { getLastTransactionType } from "@/lib/lastTransactionType";
import { NAV_LINKS } from "@/lib/navLinks";
import { DefaultDateRangeControl } from "./DefaultDateRangeControl";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [lastType, setLastType] = useState("receipt");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setLastType(getLastTransactionType());
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const sidebarBody = (
    <>
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-[var(--accent-darker)] text-white shadow-sm shadow-blue-900/20">
          <BookOpenCheck size={19} strokeWidth={2.25} />
        </span>
        <span className="text-[18px] font-semibold tracking-tight text-neutral-900">
          Khata
        </span>
      </Link>

      <Link
        href={`/transactions/new/${lastType}`}
        className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[15px] font-medium text-white shadow-sm shadow-blue-900/10 transition-colors hover:bg-[var(--accent-dark)]"
      >
        <Plus size={18} strokeWidth={2.5} />
        New Transaction
      </Link>

      <DefaultDateRangeControl />

      <nav className="flex flex-col gap-1">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
        >
          <LogOut size={18} />
          Log Out
        </button>
        <div className="px-3 text-xs text-neutral-400">Family Insurance Agency</div>
        <div className="px-3 text-xs text-neutral-400">
          Press <kbd className="rounded border border-neutral-300 px-1 font-sans">Alt + /</kbd> for
          keyboard shortcuts
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-14 w-full shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-[var(--accent-darker)] text-white">
            <BookOpenCheck size={16} strokeWidth={2.25} />
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-neutral-900">
            Khata
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 md:flex">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setMobileOpen(false);
            }
          }}
        >
          <div
            className="absolute inset-0 bg-neutral-900/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-fade-in relative flex h-full w-72 max-w-[85%] flex-col bg-[var(--surface)] px-4 py-6 shadow-xl">
            <button
              type="button"
              autoFocus
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
            >
              <X size={18} />
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
