import type { KeyboardEvent } from "react";

/** Wire this to `onKeyDown` on the div wrapping a form's fields (not its
 * buttons) to make Enter advance through the fields in DOM order and,
 * once on the last one, call `onSubmit` instead — "keep pressing Enter to
 * fill in and save a transaction". Ignores Enter on anything that isn't a
 * plain input/select (e.g. a button), so it never hijacks "Add Line" or
 * "Remove line". */
export function handleEnterToAdvance(e: KeyboardEvent<HTMLElement>, onSubmit: () => void): void {
  if (e.key !== "Enter") return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;

  e.preventDefault();
  const focusables = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>("input:not([disabled]), select:not([disabled])")
  );
  const next = focusables[focusables.indexOf(target) + 1];
  if (next) {
    next.focus();
  } else {
    onSubmit();
  }
}
