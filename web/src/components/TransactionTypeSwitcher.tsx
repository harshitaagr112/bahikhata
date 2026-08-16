"use client";

import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Percent,
  ScrollText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type AnyTransactionType = "payment" | "receipt" | "discount" | "income" | "journal";

const TYPES: { type: AnyTransactionType; label: string; icon: LucideIcon }[] = [
  { type: "receipt", label: "Receipt", icon: ArrowDownToLine },
  { type: "payment", label: "Payment", icon: ArrowUpFromLine },
  { type: "discount", label: "Discount", icon: Percent },
  { type: "income", label: "Income", icon: TrendingUp },
  { type: "journal", label: "Journal", icon: ScrollText },
];

/**
 * Lets the user switch which transaction type they're creating without
 * navigating back through the sidebar. Ledger/amount fields are
 * intentionally not preserved across a switch — the field semantics don't
 * map cleanly between types (e.g. Journal has no single "amount"), so a
 * fresh form per type is the correct behavior, not a bug.
 */
export function TransactionTypeSwitcher({ current }: { current: AnyTransactionType }) {
  const router = useRouter();

  return (
    <div className="inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
      {TYPES.map(({ type, label, icon: Icon }) => {
        const active = type === current;
        return (
          <button
            key={type}
            type="button"
            onClick={() => {
              if (!active) router.push(`/transactions/new/${type}`);
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
