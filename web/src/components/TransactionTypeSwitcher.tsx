"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

// Physical key (e.code) for each type's first letter — Receipt/Payment/
// Discount/Income/Journal all start with a different letter, so one key
// per type with no collisions. Matched by e.code rather than e.key
// because Option+letter on Mac either composes a dead-key accent (e.g.
// Option+I starts a "^" composition) or substitutes a symbol (Option+P
// types "π"), so e.key is never a plain letter here — e.code ("KeyP" etc)
// reports the physical key regardless.
const TYPE_SHORTCUT_CODES: Record<string, AnyTransactionType> = Object.fromEntries(
  TYPES.map(({ type }) => [`Key${type[0].toUpperCase()}`, type])
);

/**
 * Lets the user switch which transaction type they're creating without
 * navigating back through the sidebar. Ledger/amount fields are
 * intentionally not preserved across a switch — the field semantics don't
 * map cleanly between types (e.g. Journal has no single "amount"), so a
 * fresh form per type is the correct behavior, not a bug.
 */
export function TransactionTypeSwitcher({ current }: { current: AnyTransactionType }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;

      const type = TYPE_SHORTCUT_CODES[e.code];
      if (!type) return;

      // Always preventDefault on a matching combo, even if it's a no-op
      // (already on that type) — otherwise the browser still composes its
      // own Option+letter character (e.g. Option+P types "π") into
      // whatever field is focused. Firing regardless of focus (unlike the
      // global shortcuts) is intentional: switching type already discards
      // the form's fields, so there's no extra data-loss risk in letting
      // this fire mid-typing.
      e.preventDefault();
      if (type !== current) {
        router.push(`/transactions/new/${type}`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, router]);

  return (
    <div className="flex flex-col gap-1.5">
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
      <p className="px-1 text-xs text-neutral-400">
        Alt + first letter (R/P/D/I/J) switches type
      </p>
    </div>
  );
}
