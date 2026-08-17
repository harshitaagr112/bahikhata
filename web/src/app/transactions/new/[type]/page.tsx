"use client";

import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { useState } from "react";
import { SimpleTransactionForm, type SimpleTransactionType } from "@/components/SimpleTransactionForm";
import { JournalForm } from "@/components/JournalForm";
import { TransactionTypeSwitcher, type AnyTransactionType } from "@/components/TransactionTypeSwitcher";
import { getLastTransactionDate } from "@/lib/lastTransactionType";

const SIMPLE_TYPES: SimpleTransactionType[] = ["payment", "receipt", "discount", "income"];

export default function NewTransactionPage() {
  const params = useParams<{ type: string }>();
  const type = params.type;
  // Defaults to whatever date was used for the last transaction actually
  // saved (docs/DECISIONS.md-adjacent UX: a fresh entry continues from
  // where the last one left off, same as a paper daybook) — falls back to
  // today if nothing's been saved yet.
  const [date, setDate] = useState(getLastTransactionDate);

  const isJournal = type === "journal";
  const isSimple = SIMPLE_TYPES.includes(type as SimpleTransactionType);
  if (!isJournal && !isSimple) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <TransactionTypeSwitcher current={type as AnyTransactionType} />
      {isJournal ? (
        <JournalForm key={type} date={date} onDateChange={setDate} />
      ) : (
        <SimpleTransactionForm
          key={type}
          type={type as SimpleTransactionType}
          date={date}
          onDateChange={setDate}
        />
      )}
    </div>
  );
}
