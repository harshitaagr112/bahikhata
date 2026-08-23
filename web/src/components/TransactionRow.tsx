"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Percent,
  ScrollText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { DaybookEntry, DaybookRow, Transaction } from "@/lib/types";
import { Badge, Money } from "./ui";

const TYPE_LABELS: Record<string, string> = {
  payment: "Payment",
  receipt: "Receipt",
  discount: "Discount",
  income: "Income",
  journal: "Journal",
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  payment: ArrowUpFromLine,
  receipt: ArrowDownToLine,
  discount: Percent,
  income: TrendingUp,
  journal: ScrollText,
};

const TYPE_TONES: Record<string, "rose" | "emerald" | "amber" | "accent" | "neutral"> = {
  payment: "rose",
  receipt: "emerald",
  discount: "amber",
  income: "accent",
  journal: "neutral",
};

function amountFor(entries: DaybookEntry[]): number {
  return entries
    .filter((e) => parseFloat(e.debit) > 0)
    .reduce((sum, e) => sum + parseFloat(e.debit), 0);
}

/** Stops propagation so clicking a ledger name navigates to that ledger
 * instead of also triggering the row's own "go to transaction" click. */
function LedgerLink({ entry }: { entry: DaybookEntry }) {
  return (
    <Link
      href={`/ledgers/${entry.ledger_id}`}
      onClick={(e) => e.stopPropagation()}
      className="hover:text-[var(--accent)] hover:underline"
    >
      {entry.ledger_name}
    </Link>
  );
}

function Flow({ entries }: { entries: DaybookEntry[] }) {
  if (entries.length === 0) return <>—</>;
  const debitEntries = entries.filter((e) => parseFloat(e.debit) > 0);
  const creditEntries = entries.filter((e) => parseFloat(e.credit) > 0);

  if (debitEntries.length === 1 && creditEntries.length === 1) {
    return (
      <>
        <LedgerLink entry={creditEntries[0]} /> → <LedgerLink entry={debitEntries[0]} />
      </>
    );
  }
  return (
    <>
      {entries.map((e, i) => (
        <span key={`${e.ledger_id}-${i}`}>
          {i > 0 && ", "}
          <LedgerLink entry={e} />
        </span>
      ))}
    </>
  );
}

export function TransactionRow({
  txn,
}: {
  txn: (Transaction & { entries?: DaybookEntry[] }) | DaybookRow;
}) {
  const router = useRouter();
  const entries = "entries" in txn && txn.entries ? txn.entries : [];
  const amount = amountFor(entries);
  const Icon = TYPE_ICONS[txn.type];

  function goToTransaction() {
    router.push(`/transactions/${txn.id}/edit`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToTransaction}
      onKeyDown={(e) => {
        if (e.key === "Enter") goToTransaction();
      }}
      className="group flex flex-wrap cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-neutral-50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 group-hover:bg-white`}
        >
          {Icon && <Icon size={16} />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONES[txn.type] ?? "neutral"}>
              {TYPE_LABELS[txn.type] ?? txn.type}
            </Badge>
            <span className="text-sm font-medium text-neutral-900">
              <Flow entries={entries} />
            </span>
          </div>
          {txn.narration && (
            <div className="mt-0.5 text-sm text-neutral-600">{txn.narration}</div>
          )}
        </div>
      </div>
      <Money value={amount} className="shrink-0 text-sm font-semibold text-neutral-900" />
    </div>
  );
}
