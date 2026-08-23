"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Download, ListChecks, TrendingDown, TrendingUp } from "lucide-react";
import { getOutstanding } from "@/lib/api";
import type { OutstandingEntry } from "@/lib/types";
import { Button, Card, EmptyState, ErrorBanner, Money, PageTitle } from "@/components/ui";

function total(entries: OutstandingEntry[]): number {
  return entries.reduce((sum, e) => sum + parseFloat(e.amount), 0);
}

function OutstandingList({ entries }: { entries: OutstandingEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="Nothing outstanding" />;
  }
  return (
    <div className="flex flex-col divide-y divide-neutral-100">
      {entries.map((e) => (
        <Link
          key={e.ledger_id}
          href={`/ledgers/${e.ledger_id}`}
          className="group flex items-center justify-between rounded-lg px-2 py-3 hover:bg-neutral-50"
        >
          <span className="text-sm font-medium text-neutral-900">{e.name}</span>
          <div className="flex items-center gap-1.5">
            <Money value={e.amount} className="text-sm font-semibold" />
            <ChevronRight size={15} className="text-neutral-300 group-hover:text-neutral-400" />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function OutstandingPage() {
  const [receivables, setReceivables] = useState<OutstandingEntry[]>([]);
  const [payables, setPayables] = useState<OutstandingEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOutstanding()
      .then((r) => {
        setReceivables(r.receivables);
        setPayables(r.payables);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load outstanding"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-neutral-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle icon={<ListChecks size={20} />} subtitle="Customer and insurance-limit balances">
          Outstanding
        </PageTitle>
        <a href="/api/outstanding/pdf" target="_blank" rel="noreferrer">
          <Button variant="secondary">
            <Download size={16} />
            Export PDF
          </Button>
        </a>
      </div>
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
              <TrendingUp size={16} className="text-emerald-600" />
              Receivables
            </h2>
            <Money value={total(receivables)} className="text-sm font-semibold text-emerald-700" />
          </div>
          <OutstandingList entries={receivables} />
        </Card>
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
              <TrendingDown size={16} className="text-rose-600" />
              Payables
            </h2>
            <Money value={total(payables)} className="text-sm font-semibold text-rose-700" />
          </div>
          <OutstandingList entries={payables} />
        </Card>
      </div>
    </div>
  );
}
