export type DateRangePreset = "today" | "this_week" | "this_month" | "this_year" | "all_time" | "custom";

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  this_year: "This Year",
  all_time: "All Time",
  custom: "Custom Range",
};

export const DATE_RANGE_PRESET_ORDER: DateRangePreset[] = [
  "today",
  "this_week",
  "this_month",
  "this_year",
  "all_time",
  "custom",
];

const KEY = "khata:defaultDateRange";

export interface DateRangeSetting {
  preset: DateRangePreset;
  customFrom?: string;
  customTo?: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeRange(setting: DateRangeSetting): { from: string; to: string } {
  const now = new Date();
  switch (setting.preset) {
    case "today":
      return { from: todayISO(), to: todayISO() };
    case "this_week": {
      const day = now.getDay(); // 0 = Sunday
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      return { from: toISO(monday), to: todayISO() };
    }
    case "this_month":
      return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayISO() };
    case "this_year":
      return { from: toISO(new Date(now.getFullYear(), 0, 1)), to: todayISO() };
    case "all_time":
      // No transaction predates this — see Tally importer cutover notes in
      // CLAUDE.md — well before any real ledger's history can start.
      return { from: "1900-01-01", to: todayISO() };
    case "custom":
      if (setting.customFrom && setting.customTo) {
        return { from: setting.customFrom, to: setting.customTo };
      }
      return { from: todayISO(), to: todayISO() };
  }
}

/** Reads the user's saved default-range preference (Nav sidebar's "Default
 * Range" control). Falls back to "Today" — the previous hardcoded
 * behavior — if nothing has been saved yet. */
export function getDefaultDateRangeSetting(): DateRangeSetting {
  if (typeof window === "undefined") return { preset: "today" };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { preset: "today" };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.preset === "string") return parsed as DateRangeSetting;
  } catch {
    // Ignore malformed storage and fall back to the default.
  }
  return { preset: "today" };
}

export function setDefaultDateRangeSetting(setting: DateRangeSetting): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(setting));
}

/** Resolves the saved preference into concrete from/to dates. Non-custom
 * presets are recomputed from today's date on every call rather than
 * frozen at save time, so e.g. "This Month" always tracks the current
 * month. Pages should call this once for their initial from/to state —
 * every date-range page still has its own From/To fields to change the
 * range for that view alone, same as before. */
export function getDefaultDateRange(): { from: string; to: string } {
  return computeRange(getDefaultDateRangeSetting());
}
