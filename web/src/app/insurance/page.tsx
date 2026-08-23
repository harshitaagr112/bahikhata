"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, HandCoins, PlusCircle, Search, ShieldCheck } from "lucide-react";
import { searchInsurancePolicies } from "@/lib/api";
import type { InsurancePolicy } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorBanner, Money, PageTitle, TextInput } from "@/components/ui";

function expiryTone(expiryDate: string): "rose" | "amber" | "neutral" {
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return "rose";
  if (days <= 30) return "amber";
  return "neutral";
}

/** A muted "label: value" chip — used so every stored field is visible
 * directly on this list, not just in the edit form or the trimmed PDF. */
function DetailChip({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <span className="text-xs text-neutral-400">
      <span className="text-neutral-500">{label}:</span> {value}
    </span>
  );
}

export default function InsurancePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InsurancePolicy[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      searchInsurancePolicies(query)
        .then(setResults)
        .catch((e) => setError(e instanceof Error ? e.message : "Search failed"));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle icon={<ShieldCheck size={20} />} subtitle="Vehicle & health insurance policies">
          Insurance
        </PageTitle>
        <div className="flex gap-2.5">
          <Link href="/insurance/commission-payouts">
            <Button variant="secondary">
              <HandCoins size={16} />
              Commission Payouts
            </Button>
          </Link>
          <Link href="/insurance/renewals">
            <Button variant="secondary">Renewal Report</Button>
          </Link>
          <Link href="/insurance/new">
            <Button>
              <PlusCircle size={17} />
              Add Policy
            </Button>
          </Link>
        </div>
      </div>
      <ErrorBanner message={error} />

      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <TextInput
          autoFocus
          className="pl-11 py-3 text-base"
          placeholder="Search by insured name, registration no., policy no., mobile..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        {results.length === 0 ? (
          <EmptyState
            icon={<Search size={20} />}
            title={query ? "No policy found" : "No policies yet"}
            description={query ? undefined : "Add your first policy with the button above."}
          />
        ) : (
          <div className="flex flex-col divide-y divide-neutral-100">
            {results.map((p) => (
              <Link
                key={p.id}
                href={`/insurance/${p.id}/edit`}
                className="group flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-neutral-50"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-900">{p.insured_name}</div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge tone="accent">{p.company}</Badge>
                    {p.vehicle_category && <Badge>{p.vehicle_category}</Badge>}
                    <Badge tone={expiryTone(p.expiry_date)}>Expires {p.expiry_date}</Badge>
                    {p.ledger_id && <Badge tone="emerald">Linked Customer</Badge>}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <DetailChip label="Location" value={p.location} />
                    <DetailChip label="Mobile" value={p.mobile_no} />
                    <DetailChip label="Vehicle" value={p.vehicle_model} />
                    <DetailChip label="Reg No" value={p.registration_no} />
                    <DetailChip label="Policy No" value={p.policy_no} />
                    <DetailChip label="Payment" value={p.payment_mode} />
                    <DetailChip label="Issued" value={p.issue_date} />
                    <DetailChip label="Sum Assured" value={p.sum_assured} />
                    <DetailChip label="OD Prem" value={p.od_premium} />
                    <DetailChip label="Net Prem" value={p.net_premium} />
                    <DetailChip label="Total Prem" value={p.total_premium} />
                    {p.commission_percentage && (
                      <span className="text-xs text-neutral-400">
                        <span className="text-neutral-500">Commission:</span> {p.commission_percentage}% of{" "}
                        {p.commission_basis === "od_premium" ? "OD" : "Net"} Prem
                        {p.commission_amount && (
                          <>
                            {" "}
                            (<Money value={p.commission_amount} />)
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="mt-1 shrink-0 text-neutral-300 group-hover:text-neutral-400" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
