"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteInsurancePolicy, getInsurancePolicy, getLedger } from "@/lib/api";
import type { InsurancePolicy, Ledger } from "@/lib/types";
import { InsurancePolicyForm } from "@/components/InsurancePolicyForm";
import { Button, ErrorBanner } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function EditInsurancePolicyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [policy, setPolicy] = useState<InsurancePolicy | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getInsurancePolicy(id)
      .then(async (p) => {
        setPolicy(p);
        if (p.ledger_id) {
          setLedger(await getLedger(p.ledger_id));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load insurance policy"));
  }, [id]);

  async function handleDelete() {
    try {
      await deleteInsurancePolicy(id);
      router.push("/insurance");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setConfirmDelete(false);
    }
  }

  if (error && !policy) return <ErrorBanner message={error} />;
  if (!policy) return <p className="text-neutral-500">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} />
          Delete Policy
        </Button>
      </div>
      <ErrorBanner message={error} />
      <InsurancePolicyForm policyId={policy.id} initial={policy} initialLedger={ledger} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this insurance policy?"
        message="This cannot be undone."
        confirmLabel="Yes, delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
