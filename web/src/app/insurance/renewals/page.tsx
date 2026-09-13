"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { getInsuranceRenewals, listInsuranceCompanies } from "@/lib/api";
import { KNOWN_INSURANCE_COMPANIES, type InsurancePolicy } from "@/lib/types";
import { getDefaultDateRange } from "@/lib/dateRange";
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

function groupByCompanyAndCategory(
  rows: InsurancePolicy[]
): [string, [string, InsurancePolicy[]][]][] {
  const byCompany = new Map<string, InsurancePolicy[]>();
  for (const row of rows) {
    const list = byCompany.get(row.company) ?? [];
    list.push(row);
    byCompany.set(row.company, list);
  }
  return Array.from(byCompany.entries()).map(([company, companyRows]) => {
    const byCategory = new Map<string, InsurancePolicy[]>();
    for (const row of companyRows) {
      const key = row.vehicle_category ?? "";
      const list = byCategory.get(key) ?? [];
      list.push(row);
      byCategory.set(key, list);
    }
    return [company, Array.from(byCategory.entries())];
  });
}

export default function InsuranceRenewalsPage() {
  const defaultRange = getDefaultDateRange();
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
    getInsuranceRenewals(from, to, company || undefined)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load renewals"))
      .finally(() => setLoading(false));
  }, [from, to, company]);

  const groups = groupByCompanyAndCategory(rows);
  const pdfParams = new URLSearchParams({ from, to });
  if (company) pdfParams.set("company", company);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageTitle icon={<ShieldCheck size={20} />} subtitle="Policies expiring in this range, by company">
          Renewal Report
        </PageTitle>
        <a href={`/api/insurance/renewals/pdf?${pdfParams.toString()}`} target="_blank" rel="noreferrer">
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
          <EmptyState title="No policies expiring in this range" />
        </Card>
      ) : (
        groups.map(([groupCompany, categories]) => (
          <Card key={groupCompany}>
            <div className="mb-3 text-[15px] font-semibold text-neutral-900">{groupCompany}</div>
            {categories.map(([category, catRows]) => (
              <div key={category || "uncategorized"} className="mb-4 last:mb-0">
                {category && (
                  <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-400">
                    {category}
                  </div>
                )}
                <div className="flex flex-col divide-y divide-neutral-100">
                  {catRows.map((row) => (
                    <Link
                      key={row.id}
                      href={`/insurance/${row.id}/edit`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-neutral-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-neutral-900">{row.insured_name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-400">
                          {row.registration_no && <span>{row.registration_no}</span>}
                          {row.location && <span>{row.location}</span>}
                          <Badge>Expires {row.expiry_date}</Badge>
                        </div>
                      </div>
                      <Money value={row.total_premium} className="text-sm font-medium" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        ))
      )}
    </div>
  );
}
