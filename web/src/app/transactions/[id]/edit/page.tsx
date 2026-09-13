"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { deleteTransaction, getLedger, getTransaction } from "@/lib/api";
import type { Ledger, TransactionWithEntries } from "@/lib/types";
import { getReturnTo } from "@/lib/returnTo";
import { SimpleTransactionForm, type SimpleTransactionType } from "@/components/SimpleTransactionForm";
import { JournalForm } from "@/components/JournalForm";
import { Button, ErrorBanner } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const SIMPLE_TYPES: SimpleTransactionType[] = ["payment", "receipt", "discount", "income"];

export default function EditTransactionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [txn, setTxn] = useState<TransactionWithEntries | null>(null);
  const [ledgers, setLedgers] = useState<Map<number, Ledger>>(new Map());
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getTransaction(id)
      .then(async (t) => {
        setTxn(t);
        const uniqueIds = Array.from(new Set(t.entries.map((e) => e.ledger_id)));
        const fetched = await Promise.all(uniqueIds.map((lid) => getLedger(lid)));
        setLedgers(new Map(fetched.map((l) => [l.id, l])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load transaction"));
  }, [id]);

  async function handleDelete() {
    try {
      await deleteTransaction(id);
      router.push(getReturnTo());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setConfirmDelete(false);
    }
  }

  if (error && !txn) return <ErrorBanner message={error} />;
  if (!txn || ledgers.size === 0) return <p className="text-neutral-500">Loading...</p>;

  const narration = txn.narration ?? "";

  let form: ReactNode;
  if (txn.type === "journal") {
    form = (
      <JournalForm
        transactionId={txn.id}
        initial={{
          date: txn.txn_date,
          narration,
          lines: txn.entries.map((e) => ({
            ledger: ledgers.get(e.ledger_id) ?? null,
            debit: e.debit > 0 ? String(e.debit) : "",
            credit: e.credit > 0 ? String(e.credit) : "",
          })),
        }}
      />
    );
  } else if (SIMPLE_TYPES.includes(txn.type as SimpleTransactionType)) {
    const type = txn.type as SimpleTransactionType;
    const creditEntry = txn.entries.find((e) => e.credit > 0);
    const debitEntry = txn.entries.find((e) => e.debit > 0);
    const creditLedger = creditEntry ? ledgers.get(creditEntry.ledger_id) : undefined;
    const debitLedger = debitEntry ? ledgers.get(debitEntry.ledger_id) : undefined;

    if (!creditLedger || !debitLedger) {
      form = <ErrorBanner message="Could not resolve this transaction's ledgers" />;
    } else {
      form = (
        <SimpleTransactionForm
          type={type}
          transactionId={txn.id}
          initial={{
            date: txn.txn_date,
            narration,
            amount: String(debitEntry!.debit),
            creditLedger,
            debitLedger,
          }}
        />
      );
    }
  } else {
    form = <ErrorBanner message={`Unknown transaction type: ${txn.type}`} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} />
          Delete Transaction
        </Button>
      </div>

      <ErrorBanner message={error} />
      {form}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this transaction?"
        message="This affects ledger balances and cannot be undone."
        confirmLabel="Yes, delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
