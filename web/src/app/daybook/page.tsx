"use client";

import { useEffect, useState } from "react";
import { BookOpenText, Download } from "lucide-react";
import { getDaybook } from "@/lib/api";
import type { DaybookRow } from "@/lib/types";
import { Button, Card, EmptyState, ErrorBanner, Field, Money, PageTitle, TextInput } from "@/components/ui";
import { TransactionRow } from "@/components/TransactionRow";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function groupByDate(rows: DaybookRow[]): [string, DaybookRow[]][] {
  const groups = new Map<string, DaybookRow[]>();
  for (const row of rows) {
    const list = groups.get(row.txn_date) ?? [];
    list.push(row);
    groups.set(row.txn_date, list);
  }
  return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export default function DaybookPage() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<DaybookRow[]>([]);
  const [totals, setTotals] = useState({ total_debit: "0.00", total_credit: "0.00" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDaybook(from, to)
      .then((res) => {
        setRows(res.transactions);
        setTotals({ total_debit: res.total_debit, total_credit: res.total_credit });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load daybook"))
      .finally(() => setLoading(false));
  }, [from, to]);

  const groups = groupByDate(rows);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle icon={<BookOpenText size={20} />} subtitle="Chronological record of every transaction">
          Daybook
        </PageTitle>
        <a href={`/api/daybook/pdf?from=${from}&to=${to}`} target="_blank" rel="noreferrer">
          <Button variant="secondary">
            <Download size={16} />
            Export PDF
          </Button>
        </a>
      </div>
      <ErrorBanner message={error} />

      <Card className="flex flex-col gap-4 py-4 sm:flex-row">
        <Field label="From">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </Card>

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState title="No transactions in this date range" />
        </Card>
      ) : (
        <>
          {groups.map(([date, dayRows]) => (
            <Card key={date}>
              <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400">
                {new Date(date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="flex flex-col divide-y divide-neutral-100">
                {dayRows.map((row) => (
                  <TransactionRow key={row.id} txn={row} />
                ))}
              </div>
            </Card>
          ))}
          <Card className="flex items-center justify-between bg-neutral-50 py-4">
            <span className="text-sm font-medium text-neutral-500">Total for this range</span>
            <span className="text-sm font-semibold text-neutral-900">
              Debit <Money value={totals.total_debit} /> &nbsp;·&nbsp; Credit{" "}
              <Money value={totals.total_credit} />
            </span>
          </Card>
        </>
      )}
    </div>
  );
}
