"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "./ui";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 p-4 backdrop-blur-[2px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        } else if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") {
          e.stopPropagation();
          onConfirm();
        }
      }}
    >
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full ${
            danger ? "bg-rose-50 text-rose-600" : "bg-[var(--accent-soft)] text-[var(--accent)]"
          }`}
        >
          {danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
        </span>
        <h2 className="mt-3 text-[17px] font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1.5 text-[14px] text-neutral-500">{message}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          {/* Danger dialogs autofocus Cancel so a stray Enter can't confirm
           * a destructive action; non-danger dialogs autofocus Confirm so
           * "keep pressing Enter" carries a user through a normal save. */}
          <Button variant="secondary" autoFocus={danger} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} autoFocus={!danger} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
