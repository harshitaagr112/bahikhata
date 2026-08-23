"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Plus, ScrollText, X, XCircle } from "lucide-react";
import { createTransaction, updateTransaction } from "@/lib/api";
import { setLastTransactionDate, setLastTransactionType } from "@/lib/lastTransactionType";
import type { Ledger } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, Money, PageTitle, TextInput } from "./ui";
import { LedgerPicker } from "./LedgerPicker";
import { ConfirmDialog } from "./ConfirmDialog";

interface JournalLine {
  ledger: Ledger | null;
  debit: string;
  credit: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): JournalLine {
  return { ledger: null, debit: "", credit: "" };
}

export function JournalForm({
  transactionId,
  initial,
  date: controlledDate,
  onDateChange,
}: {
  transactionId?: number;
  initial?: { date: string; narration: string; lines: JournalLine[] };
  /** See SimpleTransactionForm's version of these two props — keeps date
   * intact across a type switch. */
  date?: string;
  onDateChange?: (date: string) => void;
}) {
  const router = useRouter();
  const isEdit = transactionId !== undefined;

  const [internalDate, setInternalDate] = useState(initial?.date ?? todayISO());
  const date = controlledDate ?? internalDate;
  const setDate = onDateChange ?? setInternalDate;
  const [narration, setNarration] = useState(initial?.narration ?? "");
  const [lines, setLines] = useState<JournalLine[]>(initial?.lines ?? [emptyLine(), emptyLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  function updateLine(index: number, patch: Partial<JournalLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string | null {
    if (lines.length < 2) return "A journal needs at least two lines";
    for (const l of lines) {
      if (!l.ledger) return "Every line needs a ledger";
      const d = parseFloat(l.debit) || 0;
      const c = parseFloat(l.credit) || 0;
      if (d > 0 && c > 0) return "A line cannot have both debit and credit";
      if (d === 0 && c === 0) return "Every line needs a debit or credit amount";
    }
    if (!balanced) return "Total debit must equal total credit";
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = {
        type: "journal" as const,
        date,
        narration: narration || undefined,
        lines: lines.map((l) => ({
          ledger_id: l.ledger!.id,
          debit: l.debit || undefined,
          credit: l.credit || undefined,
        })),
      };
      if (isEdit) {
        await updateTransaction(transactionId!, input);
      } else {
        await createTransaction(input);
      }
      setLastTransactionType("journal");
      setLastTransactionDate(date);
      router.push("/daybook");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save journal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle icon={<ScrollText size={20} />}>
        {isEdit ? "Edit Journal" : "Journal"}
      </PageTitle>
      <ErrorBanner message={error} />

      <Card>
        <div className="flex flex-col gap-4">
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <div className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-neutral-50/60 p-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <LedgerPicker
                    label={`Account ${i + 1}`}
                    value={line.ledger}
                    onChange={(l) => updateLine(i, { ledger: l })}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 sm:w-28 sm:flex-none">
                    <Field label="Debit">
                      <TextInput
                        inputMode="decimal"
                        value={line.debit}
                        onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })}
                      />
                    </Field>
                  </div>
                  <div className="flex-1 sm:w-28 sm:flex-none">
                    <Field label="Credit">
                      <TextInput
                        inputMode="decimal"
                        value={line.credit}
                        onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })}
                      />
                    </Field>
                  </div>
                  {lines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="flex h-[42px] w-9 shrink-0 items-center justify-center self-end rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove line"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button variant="secondary" onClick={addLine} className="self-start">
            <Plus size={16} />
            Add Line
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm">
            <span className="tabular text-neutral-600">
              Total Debit: <Money value={totalDebit} className="font-medium text-neutral-900" /> · Total
              Credit: <Money value={totalCredit} className="font-medium text-neutral-900" />
            </span>
            <span
              className={`flex items-center gap-1.5 font-medium ${balanced ? "text-emerald-600" : "text-rose-600"}`}
            >
              {balanced ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {balanced ? "Balanced" : "Not balanced"}
            </span>
          </div>

          <Field label="Narration (optional)">
            <TextInput value={narration} onChange={(e) => setNarration(e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={() => (isEdit ? setConfirmOpen(true) : submit())} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Save Journal"}
          </Button>
          <Button variant="secondary" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Save these changes?"
        message="Are you sure you want to make this change? This will affect ledger balances."
        onConfirm={() => {
          setConfirmOpen(false);
          submit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
