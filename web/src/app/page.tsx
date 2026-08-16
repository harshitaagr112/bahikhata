"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  LayoutDashboard,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getDaybook, getLedgerBalance, getOutstanding, searchLedgers } from "@/lib/api";
import type { DaybookRow, Ledger } from "@/lib/types";
import { Card, EmptyState, ErrorBanner, Money, MoneyDrCr, PageTitle } from "@/components/ui";
import { TransactionRow } from "@/components/TransactionRow";

interface CashBankBalance {
  ledger: Ledger;
  balance: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({
  icon,
  label,
  value,
  tone,
  signed,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "neutral" | "emerald" | "rose";
  /** Pass true when value can be negative (a real ledger balance) so it
   * renders as "Dr"/"Cr" instead of a minus sign. Receivables/Payables
   * totals are already unsigned (split by sign server-side), so they
   * should not set this. */
  signed?: boolean;
}) {
  const toneClasses = {
    neutral: "bg-[var(--accent-soft)] text-[var(--accent)]",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
  }[tone];
  return (
    <Card className="flex items-center gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}>
        {icon}
      </span>
      <div>
        <div className="text-[13px] font-medium text-neutral-500">{label}</div>
        {signed ? (
          <MoneyDrCr value={value} className="block text-xl font-semibold text-neutral-900" />
        ) : (
          <Money value={value} className="block text-xl font-semibold text-neutral-900" />
        )}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [cashBank, setCashBank] = useState<CashBankBalance[]>([]);
  const [receivablesTotal, setReceivablesTotal] = useState(0);
  const [payablesTotal, setPayablesTotal] = useState(0);
  const [todayTxns, setTodayTxns] = useState<DaybookRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ledgers, outstanding, daybook] = await Promise.all([
          searchLedgers(""),
          getOutstanding(),
          getDaybook(todayISO(), todayISO()),
        ]);

        const cashBankLedgers = ledgers.filter(
          (l) => l.type === "cash" || l.type === "bank"
        );
        const balances = await Promise.all(
          cashBankLedgers.map(async (ledger) => ({
            ledger,
            balance: (await getLedgerBalance(ledger.id)).balance,
          }))
        );
        setCashBank(balances);

        setReceivablesTotal(
          outstanding.receivables.reduce((sum, e) => sum + parseFloat(e.amount), 0)
        );
        setPayablesTotal(
          outstanding.payables.reduce((sum, e) => sum + parseFloat(e.amount), 0)
        );
        setTodayTxns(daybook.transactions);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="text-neutral-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle icon={<LayoutDashboard size={20} />} subtitle="Today's snapshot">
        Dashboard
      </PageTitle>
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cashBank.map(({ ledger, balance }) => (
          <StatCard
            key={ledger.id}
            icon={ledger.type === "cash" ? <Wallet size={20} /> : <Banknote size={20} />}
            label={ledger.name}
            value={balance}
            tone="neutral"
            signed
          />
        ))}
        {cashBank.length === 0 && (
          <Card className="sm:col-span-2">
            <EmptyState
              icon={<Wallet size={22} />}
              title="No Cash or Bank ledgers yet"
              description="Create one from any transaction form using + Create New Ledger."
            />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Receivables"
          value={receivablesTotal}
          tone="emerald"
        />
        <StatCard
          icon={<TrendingDown size={20} />}
          label="Payables"
          value={payablesTotal}
          tone="rose"
        />
      </div>

      <Card>
        <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
          <Receipt size={17} className="text-neutral-400" />
          Today&apos;s Transactions
        </div>
        {todayTxns.length === 0 ? (
          <EmptyState title="Nothing recorded today" />
        ) : (
          <div className="mt-2 flex flex-col divide-y divide-neutral-100">
            {todayTxns.map((t) => (
              <TransactionRow key={t.id} txn={t} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
