"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Download, GitMerge, Pencil, Phone, Trash2, Users } from "lucide-react";
import {
  addLedgerMobileNumber,
  deleteLedger,
  getLedger,
  getLedgerStatement,
  listLedgerMobileNumbers,
  mergeLedger,
  updateLedger,
} from "@/lib/api";
import { LEDGER_TYPES, type Ledger, type LedgerMobileNumber, type LedgerType, type StatementResponse } from "@/lib/types";
import { getDefaultDateRange } from "@/lib/dateRange";
import { Badge, Button, Card, ErrorBanner, Field, Money, MoneyDrCr, PageTitle, Select, TextInput } from "@/components/ui";
import { LedgerPicker } from "@/components/LedgerPicker";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function LedgerDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const defaultRange = getDefaultDateRange();
  const initialFrom = searchParams.get("from") || defaultRange.from;
  const initialTo = searchParams.get("to") || (searchParams.get("from") ? initialFrom : defaultRange.to);

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [mobileNumbers, setMobileNumbers] = useState<LedgerMobileNumber[]>([]);
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<LedgerType>("customer");
  const [editCo, setEditCo] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [newMobile, setNewMobile] = useState("");
  const [addingMobile, setAddingMobile] = useState(false);

  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Ledger | null>(null);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function loadLedger() {
    getLedger(id).then((l) => {
      setLedger(l);
      setEditName(l.name);
      setEditType(l.type);
      setEditCo(l.c_o ?? "");
      setEditAddress(l.address ?? "");
    });
    listLedgerMobileNumbers(id).then(setMobileNumbers);
  }

  useEffect(() => {
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    getLedgerStatement(id, from, to)
      .then(setStatement)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load statement"));
  }, [id, from, to]);

  async function handleSaveEdit() {
    try {
      await updateLedger(id, {
        name: editName,
        type: editType,
        c_o: editCo || undefined,
        address: editAddress || undefined,
      });
      setEditing(false);
      loadLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update ledger");
    }
  }

  async function handleAddMobile() {
    if (!newMobile.trim()) return;
    setAddingMobile(true);
    try {
      await addLedgerMobileNumber(id, newMobile.trim());
      setNewMobile("");
      loadLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add mobile number");
    } finally {
      setAddingMobile(false);
    }
  }

  async function handleMerge() {
    if (!mergeTarget) return;
    try {
      await mergeLedger(id, mergeTarget.id);
      router.push(`/ledgers/${mergeTarget.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    }
  }

  async function handleDelete() {
    try {
      await deleteLedger(id);
      router.push("/ledgers");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setConfirmDelete(false);
    }
  }

  if (!ledger) return <p className="text-neutral-500">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <ErrorBanner message={error} />

      <Card>
        {editing ? (
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={editType} onChange={(e) => setEditType(e.target.value as LedgerType)}>
                {LEDGER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="C/O">
              <TextInput value={editCo} onChange={(e) => setEditCo(e.target.value)} />
            </Field>
            <Field label="Address">
              <TextInput value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </Field>
            <Field
              label="Add Mobile Number (optional)"
              hint="Mobile numbers are append-only history — this adds a new one, it doesn't replace existing ones."
            >
              <div className="flex gap-2">
                <TextInput
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddMobile}
                  disabled={addingMobile || !newMobile.trim()}
                >
                  Add
                </Button>
              </div>
            </Field>
            <div className="flex gap-3">
              <Button onClick={handleSaveEdit}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <PageTitle icon={<Users size={20} />}>{ledger.name}</PageTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="accent">{ledger.type}</Badge>
                {ledger.c_o && <span className="text-sm text-neutral-400">C/O {ledger.c_o}</span>}
                {ledger.address && <span className="text-sm text-neutral-400">{ledger.address}</span>}
              </div>
              {mobileNumbers.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
                  <Phone size={14} className="text-neutral-400" />
                  {mobileNumbers.map((m) => m.number).join(", ")}
                </div>
              )}
            </div>
            {!ledger.is_system && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil size={15} />
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => setShowMerge(true)}>
                  <GitMerge size={15} />
                  Merge
                </Button>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={15} />
                  Delete
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Field label="From">
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <a
            href={`/api/ledgers/${id}/statement/pdf?from=${from}&to=${to}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="secondary" className="w-full sm:w-auto">
              <Download size={16} />
              Export PDF
            </Button>
          </a>
        </div>

        {statement ? (
          <div className="flex flex-col">
            <div className="flex justify-between rounded-lg bg-neutral-50 px-3 py-2.5 text-sm font-medium text-neutral-500">
              <span>Opening Balance</span>
              <MoneyDrCr value={statement.opening_balance} />
            </div>
            <div className="overflow-x-auto">
              <table className="mt-1 w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[13px] text-neutral-400">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Particular</th>
                    <th className="px-3 py-2 text-right font-medium">Debit</th>
                    <th className="px-3 py-2 text-right font-medium">Credit</th>
                    <th className="px-3 py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {statement.entries.map((row) => (
                    <tr
                      key={row.entry_id}
                      className="group cursor-pointer hover:bg-neutral-50"
                      onClick={() => router.push(`/transactions/${row.transaction_id}/edit`)}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap text-neutral-500">{row.date}</td>
                      <td className="px-3 py-2.5 text-neutral-900">
                        <div className="font-medium">
                          {row.counterparties.length > 0 ? (
                            row.counterparties.map((cp, i) => (
                              <span key={cp.ledger_id}>
                                {i > 0 && ", "}
                                <Link
                                  href={`/ledgers/${cp.ledger_id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:text-[var(--accent)] hover:underline"
                                >
                                  {cp.name}
                                </Link>
                              </span>
                            ))
                          ) : (
                            row.type
                          )}
                        </div>
                        {row.narration && (
                          <div className="mt-0.5 text-sm text-neutral-600">{row.narration}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {parseFloat(row.debit) > 0 ? <Money value={row.debit} /> : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {parseFloat(row.credit) > 0 ? <Money value={row.credit} /> : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium text-neutral-900">
                        <MoneyDrCr value={row.balance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {statement.entries.length === 0 && (
              <p className="mt-3 px-3 text-sm text-neutral-400">No transactions in this date range.</p>
            )}
            <div className="mt-3 flex justify-between px-3 text-sm text-neutral-500">
              <span>Total Debit / Credit</span>
              <span>
                <Money value={statement.total_debit} /> / <Money value={statement.total_credit} />
              </span>
            </div>
            <div className="mt-1 flex justify-between rounded-lg bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-900">
              <span>Closing Balance</span>
              <MoneyDrCr value={statement.closing_balance} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">Loading statement...</p>
        )}
      </Card>

      {showMerge && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/30 p-4 backdrop-blur-[2px]">
          <div className="animate-fade-in w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <GitMerge size={20} />
              </span>
              <h2 className="text-[17px] font-semibold text-neutral-900">
                Merge &quot;{ledger.name}&quot; into...
              </h2>
            </div>
            <p className="mt-3 text-sm text-neutral-500">
              All transaction history will move to the ledger you choose below. This
              ledger will no longer be selectable afterwards. This cannot be undone.
            </p>
            <div className="mt-4">
              <LedgerPicker label="Merge into" value={mergeTarget} onChange={setMergeTarget} excludeSystem />
            </div>
            <div className="mt-6 flex justify-end gap-2.5 border-t border-neutral-100 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowMerge(false);
                  setMergeTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={!mergeTarget}
                onClick={() => setConfirmMerge(true)}
              >
                Merge
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmMerge}
        title="Merge these ledgers?"
        message={`"${ledger.name}" will be permanently merged into "${mergeTarget?.name}". This cannot be undone.`}
        confirmLabel="Yes, merge permanently"
        danger
        onConfirm={() => {
          setConfirmMerge(false);
          setShowMerge(false);
          handleMerge();
        }}
        onCancel={() => setConfirmMerge(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this ledger?"
        message="This is only possible if the ledger has no transaction history. This cannot be undone."
        confirmLabel="Yes, delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export default function LedgerDetailPage() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading...</p>}>
      <LedgerDetailContent />
    </Suspense>
  );
}
