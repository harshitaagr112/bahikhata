"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Phone, UserPlus, Search, UsersRound } from "lucide-react";
import { addLedgerMobileNumber, createLedger, getLedgerBalance, searchLedgers } from "@/lib/api";
import { LEDGER_TYPES, type Ledger, type LedgerType } from "@/lib/types";
import { Badge, Button, Field, MoneyDrCr, Select, TextInput } from "./ui";

const PREFERRED_LEDGER_TYPES: LedgerType[] = ["cash", "bank", "limit", "other", "customer", "income", "expense", "discount"];

export function LedgerPicker({
  label,
  value,
  onChange,
  excludeSystem,
}: {
  label: string;
  value: Ledger | null;
  onChange: (ledger: Ledger) => void;
  /** Hide the system "Opening Balance" ledger — pass true for every
   * Payment/Receipt/Discount/Income picker. It must stay reachable only
   * from Journal (see docs/DECISIONS.md). */
  excludeSystem?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ledger[]>([]);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [balance, setBalance] = useState<{ ledgerId: number; value: string | null } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      const queryTrimmed = query.trim();

      searchLedgers(queryTrimmed)
        .then((ledgers) => {
          const filtered = excludeSystem ? ledgers.filter((l) => !l.is_system) : ledgers;
          const ordered = [...filtered].sort((a, b) => {
            const aRank = PREFERRED_LEDGER_TYPES.indexOf(a.type);
            const bRank = PREFERRED_LEDGER_TYPES.indexOf(b.type);
            const rankA = aRank === -1 ? Number.MAX_SAFE_INTEGER : aRank;
            const rankB = bRank === -1 ? Number.MAX_SAFE_INTEGER : bRank;
            if (rankA !== rankB) return rankA - rankB;
            return a.name.localeCompare(b.name);
          });
          setResults(ordered);
          setHighlightedIndex(0);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open, excludeSystem]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (!value) return;

    let active = true;
    getLedgerBalance(value.id)
      .then((response) => {
        if (active) setBalance({ ledgerId: value.id, value: response.balance });
      })
      .catch(() => {
        if (active) setBalance({ ledgerId: value.id, value: null });
      });

    return () => {
      active = false;
    };
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const displayValue = query || (value && !open ? value.name : "");
  const slotCount = results.length + 1; // +1 for the "Create New Ledger" slot

  function selectResult(l: Ledger) {
    onChange(l);
    setQuery("");
    setOpen(false);
  }

  function openCreate() {
    setShowCreate(true);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <Field label={label}>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <TextInput
            placeholder="Search by name, mobile, address..."
            className={value && !query ? "pl-10 pr-36" : "pl-10"}
            value={displayValue}
            onFocus={() => {
              if (value) setQuery(value.name);
              setOpen(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (!open) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((i) => Math.min(i + 1, slotCount - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                if (highlightedIndex < results.length) {
                  // Selecting a result: don't stopPropagation — let this
                  // bubble to the enclosing form so Enter also advances
                  // to the next field (see lib/formNav.ts).
                  e.preventDefault();
                  selectResult(results[highlightedIndex]);
                } else {
                  e.preventDefault();
                  e.stopPropagation();
                  openCreate();
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
          {value && !query && (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-neutral-500">
              Closing: {balance?.ledgerId !== value.id || balance.value === null ? "..." : <MoneyDrCr value={balance.value} />}
            </span>
          )}
        </div>
      </Field>
      {value && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Badge tone="accent">{value.type}</Badge>
          {value.address && <span className="text-xs text-neutral-400">{value.address}</span>}
        </div>
      )}
      {open && (
        <div className="animate-fade-in absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
          <div className="max-h-56 overflow-auto p-1.5">
            {results.map((l, i) => (
              <button
                key={l.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                className={`block w-full rounded-lg px-3 py-2.5 text-left hover:bg-[var(--accent-soft)] ${
                  highlightedIndex === i ? "bg-[var(--accent-soft)]" : ""
                }`}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => selectResult(l)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900">{l.name}</span>
                  <Badge>{l.type}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                  {l.c_o && (
                    <span className="flex items-center gap-1">
                      <UsersRound size={11} className="text-neutral-400" />
                      C/O {l.c_o}
                    </span>
                  )}
                  {l.address && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} className="text-neutral-400" />
                      {l.address}
                    </span>
                  )}
                  {l.mobile_numbers && (
                    <span className="flex items-center gap-1">
                      <Phone size={11} className="text-neutral-400" />
                      {l.mobile_numbers}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="px-3 py-2 text-sm text-neutral-500">No ledger found.</div>
            )}
          </div>
          {/* Pinned footer — always visible without scrolling the results
           * above, so "Create New Ledger" never scrolls out of reach. */}
          <button
            ref={(el) => {
              itemRefs.current[results.length] = el;
            }}
            type="button"
            className={`flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2.5 text-left text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] ${
              highlightedIndex === results.length ? "bg-[var(--accent-soft)]" : ""
            }`}
            onMouseEnter={() => setHighlightedIndex(results.length)}
            onClick={openCreate}
          >
            <UserPlus size={16} />
            Create New Ledger
          </button>
        </div>
      )}
      {showCreate && (
        <CreateLedgerModal
          initialName={query}
          onClose={() => setShowCreate(false)}
          onCreated={(l) => {
            onChange(l);
            setShowCreate(false);
            setQuery("");
          }}
        />
      )}
    </div>
  );
}

export function CreateLedgerModal({
  initialName,
  onClose,
  onCreated,
}: {
  initialName: string;
  onClose: () => void;
  onCreated: (l: Ledger) => void;
}) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<LedgerType>("customer");
  const [mobile, setMobile] = useState("");
  const [co, setCo] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const ledger = await createLedger({
        name: name.trim(),
        type,
        c_o: co || undefined,
        address: address || undefined,
        opening_balance: openingBalance || undefined,
        as_of_date: openingBalance ? asOfDate : undefined,
      });
      if (mobile.trim()) {
        await addLedgerMobileNumber(ledger.id, mobile.trim());
      }
      onCreated(ledger);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create ledger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 p-4 backdrop-blur-[2px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        } else if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON" && !saving) {
          e.stopPropagation();
          handleCreate();
        }
      }}
    >
      <div className="animate-fade-in w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <UserPlus size={20} />
          </span>
          <h2 className="text-[17px] font-semibold text-neutral-900">Create New Ledger</h2>
        </div>
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Name">
            <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as LedgerType)}>
              {LEDGER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mobile (optional)">
            <TextInput value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </Field>
          <Field label="C/O (optional)">
            <TextInput value={co} onChange={(e) => setCo(e.target.value)} />
          </Field>
          <Field label="Address (optional)">
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field
            label="Opening Balance (optional)"
            hint="Use a negative number if this ledger already owes the other way."
          >
            <TextInput
              inputMode="decimal"
              placeholder="e.g. 5000.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
          </Field>
          {openingBalance && (
            <Field label="As of Date">
              <TextInput
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </Field>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2.5 border-t border-neutral-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create & Select"}
          </Button>
        </div>
      </div>
    </div>
  );
}
