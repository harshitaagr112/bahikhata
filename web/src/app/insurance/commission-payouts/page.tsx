"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, HandCoins } from "lucide-react";
import { getInsuranceCommissionPayouts, listInsuranceCompanies } from "@/lib/api";
import { KNOWN_INSURANCE_COMPANIES, type InsurancePolicy } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Money,
  PageTitle,
  Select,
  TextInput,
} from "@/components/ui";

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function groupByCompany(rows: InsurancePolicy[]): [string, InsurancePolicy[]][] {
  const byCompany = new Map<string, InsurancePolicy[]>();
  for (const row of rows) {
    const list = byCompany.get(row.company) ?? [];
    list.push(row);
    byCompany.set(row.company, list);
  }
  return Array.from(byCompany.entries());
}

export default function InsuranceCommissionPayoutsPage() {
  const defaultRange = currentMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [company, setCompany] = useState("");
  const [companies, setCompanies] = useState<string[]>(KNOWN_INSURANCE_COMPANIES);
  const [rows, setRows] = useState<InsurancePolicy[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInsuranceCompanies()
      .then((fromServer) =>
        setCompanies(Array.from(new Set([...KNOWN_INSURANCE_COMPANIES, ...fromServer])).sort())
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getInsuranceCommissionPayouts(from, to, company || undefined)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load commission payouts"))
      .finally(() => setLoading(false));
  }, [from, to, company]);

  const groups = groupByCompany(rows);
  const totalPayout = rows.reduce((sum, r) => sum + (r.commission_amount ? parseFloat(r.commission_amount) : 0), 0);
  const pdfParams = new URLSearchParams({ from, to });
  if (company) pdfParams.set("company", company);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageTitle icon={<HandCoins size={20} />} subtitle="Commission payout by policies issued in this range">
          Commission Payouts
        </PageTitle>
        <a
          href={`/api/insurance/commission-payouts/pdf?${pdfParams.toString()}`}
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="secondary">
            <Download size={16} />
            Export PDF
          </Button>
        </a>
      </div>
      <ErrorBanner message={error} />

      <Card className="flex flex-wrap gap-4 py-4">
        <Field label="From">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Company">
          <Select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState title="No policies issued in this range" />
        </Card>
      ) : (
        <>
          {groups.map(([groupCompany, companyRows]) => (
            <Card key={groupCompany}>
              <div className="mb-3 text-[15px] font-semibold text-neutral-900">{groupCompany}</div>
              <div className="flex flex-col divide-y divide-neutral-100">
                {companyRows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/insurance/${row.id}/edit`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-neutral-50"
                  >
                    <div>
                      <div className="text-sm font-medium text-neutral-900">{row.insured_name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-400">
                        {row.registration_no && <span>{row.registration_no}</span>}
                        {row.policy_no && <span>{row.policy_no}</span>}
                        <span>Issued {row.issue_date}</span>
                        {row.commission_percentage && (
                          <Badge>
                            {row.commission_percentage}% of{" "}
                            {row.commission_basis === "od_premium" ? "OD" : "Net"} Prem
                          </Badge>
                        )}
                      </div>
                    </div>
                    {row.commission_amount ? (
                      <Money value={row.commission_amount} className="text-sm font-medium" />
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
          <Card className="flex items-center justify-between bg-neutral-50 py-4">
            <span className="text-sm font-medium text-neutral-500">Total Commission Payout</span>
            <Money value={totalPayout} className="text-sm font-semibold text-neutral-900" />
          </Card>
        </>
      )}
    </div>
  );
}
