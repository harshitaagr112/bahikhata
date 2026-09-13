"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Percent,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { createTransaction, updateTransaction } from "@/lib/api";
import { setLastTransactionDate, setLastTransactionType } from "@/lib/lastTransactionType";
import { getReturnTo } from "@/lib/returnTo";
import type { CreateTransactionInput, Ledger } from "@/lib/types";
import { Button, Card, ErrorBanner, Field, PageTitle, TextInput } from "./ui";
import { LedgerPicker } from "./LedgerPicker";
import { ConfirmDialog } from "./ConfirmDialog";

const TYPE_ICONS: Record<SimpleTransactionType, LucideIcon> = {
  payment: ArrowUpFromLine,
  receipt: ArrowDownToLine,
  discount: Percent,
  income: TrendingUp,
};

export type SimpleTransactionType = "payment" | "receipt" | "discount" | "income";

interface SimpleTypeConfig {
  title: string;
  creditLabel: string;
  debitLabel: string;
  creditField: "paid_from_id" | "received_from_id" | "discount_to_id" | "income_account_id";
  debitField: "paid_to_id" | "received_in_id" | "discount_from_id" | "received_in_id";
  mobileTarget?: "credit" | "debit";
}

export const SIMPLE_TYPE_CONFIG: Record<SimpleTransactionType, SimpleTypeConfig> = {
  payment: {
    title: "Payment",
    creditLabel: "Paid From",
    debitLabel: "Paid To",
    creditField: "paid_from_id",
    debitField: "paid_to_id",
    mobileTarget: "debit",
  },
  receipt: {
    title: "Receipt",
    creditLabel: "Received From",
    debitLabel: "Received In",
    creditField: "received_from_id",
    debitField: "received_in_id",
    mobileTarget: "credit",
  },
  discount: {
    title: "Discount",
    creditLabel: "Discount To",
    debitLabel: "Discount From",
    creditField: "discount_to_id",
    debitField: "discount_from_id",
    mobileTarget: "credit",
  },
  income: {
    title: "Income",
    creditLabel: "Income Account",
    debitLabel: "Received In",
    creditField: "income_account_id",
    debitField: "received_in_id",
  },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function SimpleTransactionForm({
  type,
  transactionId,
  initial,
  date: controlledDate,
  onDateChange,
}: {
  type: SimpleTransactionType;
  transactionId?: number;
  initial?: {
    date: string;
    narration: string;
    amount: string;
    creditLedger: Ledger;
    debitLedger: Ledger;
  };
  /** Pass these two together to keep the date across a type switch (the
   * new-transaction page remounts the form on switch, which would
   * otherwise reset date back to today — unlike ledgers/amounts, date has
   * no type-specific meaning, so there's no reason to lose it). Omit both
   * for uncontrolled use (e.g. the edit page, which never switches type). */
  date?: string;
  onDateChange?: (date: string) => void;
}) {
  const router = useRouter();
  const config = SIMPLE_TYPE_CONFIG[type];
  const isEdit = transactionId !== undefined;

  const [internalDate, setInternalDate] = useState(initial?.date ?? todayISO());
  const date = controlledDate ?? internalDate;
  const setDate = onDateChange ?? setInternalDate;
  const [creditLedger, setCreditLedger] = useState<Ledger | null>(initial?.creditLedger ?? null);
  const [debitLedger, setDebitLedger] = useState<Ledger | null>(initial?.debitLedger ?? null);
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [mobile, setMobile] = useState("");
  const [narration, setNarration] = useState(initial?.narration ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function validate(): string | null {
    if (!creditLedger) return `${config.creditLabel} is required`;
    if (!debitLedger) return `${config.debitLabel} is required`;
    if (!amount || parseFloat(amount) <= 0) return "Amount must be greater than zero";
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
      const input: CreateTransactionInput = {
        type,
        date,
        amount,
        narration: narration || undefined,
        mobile: mobile || undefined,
        [config.creditField]: creditLedger!.id,
        [config.debitField]: debitLedger!.id,
      };
      if (isEdit) {
        await updateTransaction(transactionId!, input);
      } else {
        await createTransaction(input);
      }
      setLastTransactionType(type);
      setLastTransactionDate(date);
      router.push(getReturnTo());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save transaction");
    } finally {
      setSaving(false);
    }
  }

  const Icon = TYPE_ICONS[type];

  return (
    <div className="flex flex-col gap-3">
      <PageTitle icon={<Icon size={20} />}>
        {isEdit ? `Edit ${config.title}` : config.title}
      </PageTitle>
      <ErrorBanner message={error} />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <Field label="Date">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-neutral-400">
                  ₹
                </span>
                <TextInput
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-8 text-[17px] font-medium tabular"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <LedgerPicker
              label={config.creditLabel}
              value={creditLedger}
              onChange={setCreditLedger}
              excludeSystem
            />
            <LedgerPicker
              label={config.debitLabel}
              value={debitLedger}
              onChange={setDebitLedger}
              excludeSystem
            />
          </div>
          {config.mobileTarget && (
            <Field label="Mobile (optional)">
              <TextInput value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Field>
          )}
          <Field label="Narration (optional)">
            <TextInput value={narration} onChange={(e) => setNarration(e.target.value)} />
          </Field>
        </div>

        <div className="mt-4 flex gap-3">
          <Button
            onClick={() => (isEdit ? setConfirmOpen(true) : submit())}
            disabled={saving}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : `Save ${config.title}`}
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
