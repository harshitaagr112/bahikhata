"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { searchLedgers } from "@/lib/api";
import type { Ledger } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorBanner, PageTitle, TextInput } from "@/components/ui";
import { CreateLedgerModal } from "@/components/LedgerPicker";

export default function LedgersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ledger[]>([]);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      searchLedgers(query)
        .then(setResults)
        .catch((e) => setError(e instanceof Error ? e.message : "Search failed"));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageTitle icon={<Users size={20} />} subtitle="Search customers, banks, limits and more">
          Ledgers
        </PageTitle>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus size={17} />
          New Ledger
        </Button>
      </div>
      <ErrorBanner message={error} />

      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
        <TextInput
          autoFocus
          className="pl-11 py-3 text-base"
          placeholder="Search by name, mobile, address, C/O..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        {results.length === 0 ? (
          <EmptyState
            icon={<Search size={20} />}
            title={query ? "No ledger found" : "Start typing to search"}
            description={query ? undefined : "Or create a new ledger with the button above."}
          />
        ) : (
          <div className="flex flex-col divide-y divide-neutral-100">
            {results.map((l) => (
              <Link
                key={l.id}
                href={`/ledgers/${l.id}`}
                className="group flex items-center justify-between rounded-lg px-2 py-3 hover:bg-neutral-50"
              >
                <div>
                  <div className="text-sm font-medium text-neutral-900">{l.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <Badge>{l.type}</Badge>
                    {l.c_o && <span className="text-xs text-neutral-400">C/O {l.c_o}</span>}
                    {l.address && <span className="text-xs text-neutral-400">{l.address}</span>}
                    {l.mobile_numbers && (
                      <span className="text-xs text-neutral-400">{l.mobile_numbers}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-neutral-300 group-hover:text-neutral-400" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {showCreate && (
        <CreateLedgerModal
          initialName={query}
          onClose={() => setShowCreate(false)}
          onCreated={(l) => router.push(`/ledgers/${l.id}`)}
        />
      )}
    </div>
  );
}
