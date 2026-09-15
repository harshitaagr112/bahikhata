"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLastTransactionType } from "@/lib/lastTransactionType";
import { canGoBack } from "@/lib/returnTo";
import { NAV_LINKS } from "@/lib/navLinks";
import { isEditableTarget } from "@/lib/keyboard";
import { ShortcutsHelpModal } from "./ShortcutsHelpModal";

/** App-wide keyboard shortcuts: Alt+1..Alt+5 to jump between the main
 * sections, Alt+N for New Transaction, Alt+/ for a shortcuts cheat-sheet,
 * and bare Escape to back out of the current field or page. Every
 * shortcut but Escape uses the Alt modifier so it can never collide with
 * normal typing (Ctrl/Cmd combos were tried first but most single-letter
 * ones are reserved by the browser itself — Ctrl/Cmd+N opens a new
 * window, etc. — so they don't reliably reach the page; Alt+letter isn't
 * claimed by mainstream browsers). Any modal/dropdown that wants to own
 * Escape for itself (closing rather than navigating back) handles it
 * locally and calls stopPropagation, so this listener never sees it —
 * see LedgerPicker, ConfirmDialog, and the merge/mobile-nav overlays. */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // A modified Escape (e.g. Alt+Esc is "switch window" on Windows)
        // isn't ours to handle — only bare Escape triggers our behavior.
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (isEditableTarget(document.activeElement)) {
          (document.activeElement as HTMLElement).blur();
          return;
        }
        if (canGoBack()) {
          router.back();
        } else {
          router.push("/");
        }
        return;
      }

      // Every other shortcut requires bare Alt (no Ctrl/Cmd/Shift), and
      // still never fires while typing — AltGr on some European keyboard
      // layouts reports as Alt+Ctrl and is used to type ordinary
      // characters (@, €, ...), so this guard matters even though Alt
      // alone can't normally produce printable text.
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (helpOpen || isEditableTarget(e.target)) return;

      // Matched by e.code (physical key position), not e.key: on Mac,
      // Option+letter is a dead key for accented characters (Option+N
      // starts a "~" composition), so e.key comes through as "Dead"
      // rather than "n" and a key-based check silently never matches.
      if (e.code === "KeyN") {
        e.preventDefault();
        router.push(`/transactions/new/${getLastTransactionType()}`);
      } else if (e.code === "Slash") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice("Digit".length));
        if (n >= 1 && n <= NAV_LINKS.length) {
          e.preventDefault();
          router.push(NAV_LINKS[n - 1].href);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, helpOpen]);

  return <ShortcutsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
