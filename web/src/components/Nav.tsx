"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  BookOpenText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Users,
} from "lucide-react";
import { logout } from "@/lib/api";
import { getLastTransactionType } from "@/lib/lastTransactionType";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daybook", label: "Daybook", icon: BookOpenText },
  { href: "/ledgers", label: "Ledgers", icon: Users },
  { href: "/outstanding", label: "Outstanding", icon: ListChecks },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [lastType, setLastType] = useState("receipt");

  useEffect(() => {
    setLastType(getLastTransactionType());
  }, []);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6">
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
      </div>
    </aside>
  );
}
