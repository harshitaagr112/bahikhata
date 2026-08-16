"use client";

import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { SimpleTransactionForm, type SimpleTransactionType } from "@/components/SimpleTransactionForm";
import { JournalForm } from "@/components/JournalForm";
import { TransactionTypeSwitcher, type AnyTransactionType } from "@/components/TransactionTypeSwitcher";

const SIMPLE_TYPES: SimpleTransactionType[] = ["payment", "receipt", "discount", "income"];

export default function NewTransactionPage() {
  const params = useParams<{ type: string }>();
  const type = params.type;

  const isJournal = type === "journal";
  const isSimple = SIMPLE_TYPES.includes(type as SimpleTransactionType);
  if (!isJournal && !isSimple) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <TransactionTypeSwitcher current={type as AnyTransactionType} />
      {isJournal ? (
        <JournalForm key={type} />
      ) : (
        <SimpleTransactionForm key={type} type={type as SimpleTransactionType} />
      )}
    </div>
  );
}
