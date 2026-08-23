"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  createInsurancePolicy,
  listInsuranceCompanies,
  listInsuranceVehicleCategories,
  searchLedgers,
  updateInsurancePolicy,
} from "@/lib/api";
import {
  COMMISSION_BASIS_OPTIONS,
  KNOWN_INSURANCE_COMPANIES,
  type CommissionBasis,
  type InsurancePolicy,
  type InsurancePolicyInput,
  type Ledger,
} from "@/lib/types";
import { Button, Card, ErrorBanner, Field, PageTitle, Select, TextInput } from "./ui";
import { LedgerPicker } from "./LedgerPicker";
import { ConfirmDialog } from "./ConfirmDialog";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function InsurancePolicyForm({
  policyId,
  initial,
  initialLedger,
}: {
  policyId?: number;
  initial?: InsurancePolicy;
  initialLedger?: Ledger | null;
}) {
  const router = useRouter();
  const isEdit = policyId !== undefined;

  const [insuredName, setInsuredName] = useState(initial?.insured_name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [mobileNo, setMobileNo] = useState(initial?.mobile_no ?? "");
  const [paymentMode, setPaymentMode] = useState(initial?.payment_mode ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [vehicleCategory, setVehicleCategory] = useState(initial?.vehicle_category ?? "");
  const [vehicleModel, setVehicleModel] = useState(initial?.vehicle_model ?? "");
  const [registrationNo, setRegistrationNo] = useState(initial?.registration_no ?? "");
  const [policyNo, setPolicyNo] = useState(initial?.policy_no ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? todayISO());
  const [expiryDate, setExpiryDate] = useState(initial?.expiry_date ?? "");
  const [sumAssured, setSumAssured] = useState(initial?.sum_assured ?? "");
  const [odPremium, setOdPremium] = useState(initial?.od_premium ?? "");
  const [netPremium, setNetPremium] = useState(initial?.net_premium ?? "");
  const [totalPremium, setTotalPremium] = useState(initial?.total_premium ?? "");
  const [commissionBasis, setCommissionBasis] = useState<CommissionBasis>(
    initial?.commission_basis ?? "net_premium"
  );
  const [commissionPct, setCommissionPct] = useState(initial?.commission_percentage ?? "");

  const [ledger, setLedger] = useState<Ledger | null>(initialLedger ?? null);
  const [companies, setCompanies] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [mobileMatch, setMobileMatch] = useState<Ledger | null>(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    listInsuranceCompanies()
      .then((fromServer) =>
        setCompanies(
          Array.from(new Set([...KNOWN_INSURANCE_COMPANIES, ...fromServer])).sort()
        )
      )
      .catch(() => setCompanies(KNOWN_INSURANCE_COMPANIES));
    listInsuranceVehicleCategories().then(setCategories).catch(() => {});
  }, []);

  // Mobile-match suggestion: once the user's typed a plausible number and no
  // ledger is linked yet, debounce-search existing ledgers by that number
  // and offer a one-click link. Never auto-links — the user always confirms.
  useEffect(() => {
    if (ledger || mobileNo.trim().length < 6) {
      setMobileMatch(null);
      return;
    }
    const handle = setTimeout(() => {
      searchLedgers(mobileNo.trim())
        .then((results) => {
          const match = results.find((l) => l.mobile_numbers?.includes(mobileNo.trim()));
          setMobileMatch(match ?? null);
        })
        .catch(() => setMobileMatch(null));
    }, 400);
    return () => clearTimeout(handle);
  }, [mobileNo, ledger]);

  // Live preview only — the authoritative commission_amount is always
  // computed server-side (insurancePolicyResponse), same discipline as
  // every other money figure in this app.
  const commissionBasisRaw = commissionBasis === "od_premium" ? odPremium : netPremium;
  const commissionBasisNum = parseFloat(commissionBasisRaw);
  const commissionPctNum = parseFloat(commissionPct);
  const commissionPreview =
    !isNaN(commissionBasisNum) && !isNaN(commissionPctNum)
      ? ((commissionBasisNum * commissionPctNum) / 100).toFixed(2)
      : null;

  function validate(): string | null {
    if (!insuredName.trim()) return "Insured Name is required";
    if (!company.trim()) return "Company is required";
    if (!issueDate) return "Issue Date is required";
    if (!expiryDate) return "Expiry Date is required";
    if (!netPremium || parseFloat(netPremium) < 0) return "Net Premium is required";
    if (!totalPremium || parseFloat(totalPremium) < 0) return "Total Premium is required";
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
      const input: InsurancePolicyInput = {
        ledger_id: ledger?.id ?? null,
        insured_name: insuredName.trim(),
        location: location || undefined,
        mobile_no: mobileNo || undefined,
        payment_mode: paymentMode || undefined,
        company: company.trim(),
        vehicle_category: vehicleCategory || undefined,
        vehicle_model: vehicleModel || undefined,
        registration_no: registrationNo || undefined,
        policy_no: policyNo || undefined,
        issue_date: issueDate,
        expiry_date: expiryDate,
        sum_assured: sumAssured || undefined,
        od_premium: odPremium || undefined,
        net_premium: netPremium,
        total_premium: totalPremium,
        commission_basis: commissionBasis,
        commission_percentage: commissionPct || undefined,
      };
      if (isEdit) {
        await updateInsurancePolicy(policyId!, input);
      } else {
        await createInsurancePolicy(input);
      }
      router.push("/insurance");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save insurance policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle icon={<ShieldCheck size={20} />}>
        {isEdit ? "Edit Insurance Policy" : "Add Insurance Policy"}
      </PageTitle>
      <ErrorBanner message={error} />

      <Card>
        <div className="flex flex-col gap-4">
          <Field label="Insured Name">
            <TextInput value={insuredName} onChange={(e) => setInsuredName(e.target.value)} />
          </Field>
          <Field label="Location (optional)">
            <TextInput value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Mobile No. (optional)">
            <TextInput value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} />
          </Field>
          {mobileMatch && (
            <button
              type="button"
              className="-mt-1 flex items-center gap-1.5 self-start rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-medium text-[var(--accent)]"
              onClick={() => {
                setLedger(mobileMatch);
                setMobileMatch(null);
              }}
            >
              Found matching customer: {mobileMatch.name} — Link
            </button>
          )}
          <LedgerPicker
            label="Linked Customer (optional)"
            value={ledger}
            onChange={setLedger}
            excludeSystem
          />
          <Field label="Payment Mode (optional)">
            <TextInput value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} />
          </Field>
          <Field label="Insurance Company">
            <TextInput
              list="insurance-companies"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>
          <datalist id="insurance-companies">
            {companies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Field label="Vehicle Category (optional)">
            <TextInput
              list="insurance-vehicle-categories"
              value={vehicleCategory}
              onChange={(e) => setVehicleCategory(e.target.value)}
            />
          </Field>
          <datalist id="insurance-vehicle-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Field label="Vehicle Model (optional)">
            <TextInput value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
          </Field>
          <Field label="Registration No. (optional)">
            <TextInput value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Issue Date">
              <TextInput type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label="Expiry Date">
              <TextInput type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sum Assured (optional)" hint='Enter "TP" for third-party-only covers'>
              <TextInput value={sumAssured} onChange={(e) => setSumAssured(e.target.value)} />
            </Field>
            <Field label="OD Premium (optional)" hint='Enter "TP" for third-party-only covers'>
              <TextInput value={odPremium} onChange={(e) => setOdPremium(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Net Premium">
              <TextInput
                inputMode="decimal"
                value={netPremium}
                onChange={(e) => setNetPremium(e.target.value)}
              />
            </Field>
            <Field label="Total Premium">
              <TextInput
                inputMode="decimal"
                value={totalPremium}
                onChange={(e) => setTotalPremium(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Commission Basis" hint="Which premium the % is applied to">
              <Select
                value={commissionBasis}
                onChange={(e) => setCommissionBasis(e.target.value as CommissionBasis)}
              >
                {COMMISSION_BASIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Commission % (optional)">
              <TextInput
                inputMode="decimal"
                placeholder="e.g. 10"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
              />
            </Field>
          </div>
          {commissionPreview && (
            <p className="-mt-2 text-xs text-neutral-400">
              ≈ ₹{commissionPreview} commission on ₹{commissionBasisRaw} (
              {COMMISSION_BASIS_OPTIONS.find((o) => o.value === commissionBasis)?.label})
            </p>
          )}
          <Field label="Policy No. (optional)">
            <TextInput value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={() => (isEdit ? setConfirmOpen(true) : submit())} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Save Policy"}
          </Button>
          <Button variant="secondary" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Save these changes?"
        message="Are you sure you want to update this insurance policy?"
        onConfirm={() => {
          setConfirmOpen(false);
          submit();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
