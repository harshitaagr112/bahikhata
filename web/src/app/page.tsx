"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  getDaybook,
  getInsuranceRenewals,
  getLedgerBalance,
  getOutstanding,
  searchLedgers,
} from "@/lib/api";
import type { DaybookRow, InsurancePolicy, Ledger } from "@/lib/types";
import { Badge, Card, EmptyState, ErrorBanner, Money, MoneyDrCr, PageTitle } from "@/components/ui";
import { TransactionRow } from "@/components/TransactionRow";

interface CashBankBalance {
  ledger: Ledger;
  balance: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNowISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function expiryTone(expiryDate: string): "rose" | "amber" {
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  return days < 0 ? "rose" : "amber";
}

function StatCard({
  icon,
  label,
  value,
  tone,
  signed,
  href,
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
  href?: string;
}) {
  const toneClasses = {
    neutral: "bg-[var(--accent-soft)] text-[var(--accent)]",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
  }[tone];
  const card = (
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

  return href ? (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {card}
    </Link>
  ) : (
    card
  );
}

export default function DashboardPage() {
  const [cashBank, setCashBank] = useState<CashBankBalance[]>([]);
  const [receivablesTotal, setReceivablesTotal] = useState(0);
  const [payablesTotal, setPayablesTotal] = useState(0);
  const [todayTxns, setTodayTxns] = useState<DaybookRow[]>([]);
  const [renewals, setRenewals] = useState<InsurancePolicy[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ledgers, outstanding, daybook, dueRenewals] = await Promise.all([
          searchLedgers(""),
          getOutstanding(),
          getDaybook(todayISO(), todayISO()),
          // Overdue policies have no lower bound, so start well in the past
          // rather than trying to guess how far back unrenewed policies go.
          getInsuranceRenewals("1900-01-01", daysFromNowISO(30)),
        ]);
        setRenewals(
          dueRenewals
            .slice()
            .sort((a, b) => (a.expiry_date < b.expiry_date ? -1 : 1))
        );

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
            href={`/ledgers/${ledger.id}?from=${todayISO()}&to=${todayISO()}`}
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
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
            <ShieldCheck size={17} className="text-neutral-400" />
            Renewals Due
          </div>
          <Link
            href="/insurance/renewals"
            className="flex items-center gap-0.5 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            View all
            <ChevronRight size={14} />
          </Link>
        </div>
        {renewals.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={22} />}
            title="Nothing due in the next 30 days"
          />
        ) : (
          <div className="mt-2 flex flex-col divide-y divide-neutral-100">
            {renewals.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                href={`/insurance/${p.id}/edit`}
                className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-neutral-50"
              >
                <div>
                  <div className="text-sm font-medium text-neutral-900">{p.insured_name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-400">
                    {p.registration_no && <span>{p.registration_no}</span>}
                    {p.mobile_no && <span>{p.mobile_no}</span>}
                  </div>
                </div>
                <Badge tone={expiryTone(p.expiry_date)}>
                  {expiryTone(p.expiry_date) === "rose" ? "Overdue since" : "Expires"} {p.expiry_date}
                </Badge>
              </Link>
            ))}
            {renewals.length > 8 && (
              <div className="px-2 py-2.5 text-sm text-neutral-400">
                +{renewals.length - 8} more due — see the full report.
              </div>
            )}
          </div>
        )}
      </Card>

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
