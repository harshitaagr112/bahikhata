"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpenText,
  LayoutDashboard,
  ListChecks,
  Percent,
  Plus,
  ScrollText,
  TrendingUp,
  Users,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daybook", label: "Daybook", icon: BookOpenText },
  { href: "/ledgers", label: "Ledgers", icon: Users },
  { href: "/outstanding", label: "Outstanding", icon: ListChecks },
];

const NEW_TRANSACTION_LINKS = [
  { href: "/transactions/new/receipt", label: "Receipt", icon: ArrowDownToLine },
  { href: "/transactions/new/payment", label: "Payment", icon: ArrowUpFromLine },
  { href: "/transactions/new/discount", label: "Discount", icon: Percent },
  { href: "/transactions/new/income", label: "Income", icon: TrendingUp },
  { href: "/transactions/new/journal", label: "Journal", icon: ScrollText },
];

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
          T
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-neutral-900">
          Tally
        </span>
      </Link>

      <div className="relative mb-6">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[15px] font-medium text-white shadow-sm shadow-indigo-900/10 transition-colors hover:bg-indigo-700"
        >
          <Plus size={18} strokeWidth={2.5} />
          New Transaction
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="animate-fade-in absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
              {NEW_TRANSACTION_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={16} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

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

      <div className="mt-auto px-2 text-xs text-neutral-400">
        Family Insurance Agency
      </div>
    </aside>
  );
}
