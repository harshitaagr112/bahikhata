/** Shared by every global/local keydown listener in the app: shortcuts
 * must never fire while the user is typing, selecting, or editing text —
 * otherwise a literal "1" typed into an amount field, or "p" typed into a
 * narration box, would hijack navigation instead of being entered. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
