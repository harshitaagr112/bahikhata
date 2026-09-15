"use client";

import { Keyboard, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/navLinks";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="min-w-[1.75rem] rounded-md border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-center font-sans text-xs font-medium text-neutral-700">
      {children}
    </kbd>
  );
}

function Row({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-neutral-600">{label}</span>
      <Kbd>{keys}</Kbd>
    </div>
  );
}

export function ShortcutsHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/30 p-4 backdrop-blur-[2px]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Keyboard size={20} />
            </span>
            <h2 className="text-[17px] font-semibold text-neutral-900">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 divide-y divide-neutral-100">
          {NAV_LINKS.map((link, i) => (
            <Row key={link.href} keys={`Alt + ${i + 1}`} label={link.label} />
          ))}
          <Row keys="Alt + N" label="New Transaction" />
          <Row keys="Esc" label="Go back / close" />
          <Row keys="Alt + /" label="Show this list" />
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Shortcuts are ignored while typing in a field.
        </p>
      </div>
    </div>
  );
}
