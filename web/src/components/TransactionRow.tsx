import Link from "next/link";
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

function describeFlow(entries: DaybookEntry[]): { flow: string; amount: number } {
  const debitEntries = entries.filter((e) => parseFloat(e.debit) > 0);
  const creditEntries = entries.filter((e) => parseFloat(e.credit) > 0);
  const amount = debitEntries.reduce((sum, e) => sum + parseFloat(e.debit), 0);

  if (debitEntries.length === 1 && creditEntries.length === 1) {
    return { flow: `${creditEntries[0].ledger_name} → ${debitEntries[0].ledger_name}`, amount };
  }
  return { flow: entries.map((e) => e.ledger_name).join(", "), amount };
}

export function TransactionRow({
  txn,
}: {
  txn: (Transaction & { entries?: DaybookEntry[] }) | DaybookRow;
}) {
  const entries = "entries" in txn && txn.entries ? txn.entries : [];
  const { flow, amount } = describeFlow(entries);
  const Icon = TYPE_ICONS[txn.type];

  return (
    <Link
      href={`/transactions/${txn.id}/edit`}
      className="group flex items-center justify-between gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-neutral-50"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 group-hover:bg-white`}
        >
          {Icon && <Icon size={16} />}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={TYPE_TONES[txn.type] ?? "neutral"}>
              {TYPE_LABELS[txn.type] ?? txn.type}
            </Badge>
            <span className="text-sm font-medium text-neutral-900">{flow || "—"}</span>
          </div>
          {txn.narration && (
            <div className="mt-0.5 text-sm text-neutral-600">{txn.narration}</div>
          )}
        </div>
      </div>
      <Money value={amount} className="text-sm font-semibold text-neutral-900" />
    </Link>
  );
}
