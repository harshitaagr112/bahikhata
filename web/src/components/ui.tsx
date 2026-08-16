import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-neutral-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-[15px] text-neutral-900 outline-none transition-shadow placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseInput} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${baseInput} ${props.className ?? ""}`} />;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-sm shadow-indigo-900/10 hover:bg-indigo-700 active:bg-indigo-800",
  secondary:
    "bg-white text-neutral-800 border border-[var(--border)] hover:bg-neutral-50 active:bg-neutral-100",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-900/10 hover:bg-rose-700 active:bg-rose-800",
  ghost: "bg-transparent text-[var(--accent)] hover:bg-[var(--accent-soft)]",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className ?? ""}`}
    />
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(16,16,20,0.04),0_8px_24px_-12px_rgba(16,16,20,0.08)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  children,
  subtitle,
  icon,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
      )}
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-neutral-900">
          {children}
        </h1>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Money({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const formatted = n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return <span className={`tabular ${className ?? ""}`}>₹{formatted}</span>;
}

/**
 * Renders a signed ledger balance the way Tally/traditional daybooks do:
 * unsigned amount + "Dr"/"Cr" suffix instead of a minus sign. Debit
 * (positive) balance -> Dr (receivable-normal); credit (negative) balance
 * -> Cr (payable-normal). Zero shows with no suffix. Only use this for
 * genuine signed balances (opening/running/closing balance) — never for
 * plain amounts that are always non-negative (debit/credit columns,
 * transaction amounts, outstanding totals already split by sign).
 */
export function MoneyDrCr({ value, className }: { value: string | number; className?: string }) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const suffix = n > 0 ? " Dr" : n < 0 ? " Cr" : "";
  return (
    <span className={`tabular ${className ?? ""}`}>
      <Money value={Math.abs(n)} />
      {suffix}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "emerald" | "rose" | "amber" | "indigo";
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-[var(--accent-soft)] text-[var(--accent)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      {icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description && <p className="max-w-xs text-sm text-neutral-400">{description}</p>}
    </div>
  );
}
