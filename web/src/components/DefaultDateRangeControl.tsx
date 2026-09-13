"use client";

import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import {
  DATE_RANGE_PRESET_LABELS,
  DATE_RANGE_PRESET_ORDER,
  getDefaultDateRangeSetting,
  setDefaultDateRangeSetting,
  type DateRangePreset,
} from "@/lib/dateRange";
import { Select, TextInput } from "./ui";

/** Sidebar control for the app-wide default date range (Daybook, Ledger
 * Statements, Insurance Renewals/Commission reports all read this as their
 * initial From/To on load). Each of those pages keeps its own From/To
 * fields to change the range for that view alone — this only sets what
 * they start out showing. */
export function DefaultDateRangeControl() {
  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const saved = getDefaultDateRangeSetting();
    setPreset(saved.preset);
    setCustomFrom(saved.customFrom ?? "");
    setCustomTo(saved.customTo ?? "");
  }, []);

  return (
    <div className="mb-5 flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
        <CalendarRange size={13} />
        Default Range
      </div>
      <Select
        aria-label="Default date range"
        value={preset}
        onChange={(e) => {
          const next = e.target.value as DateRangePreset;
          setPreset(next);
          setDefaultDateRangeSetting({ preset: next, customFrom, customTo });
        }}
        className="!py-2 text-sm"
      >
        {DATE_RANGE_PRESET_ORDER.map((p) => (
          <option key={p} value={p}>
            {DATE_RANGE_PRESET_LABELS[p]}
          </option>
        ))}
      </Select>
      {preset === "custom" && (
        <div className="flex flex-col gap-2">
          <TextInput
            aria-label="Default range from date"
            type="date"
            className="!py-2 text-sm"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setDefaultDateRangeSetting({ preset: "custom", customFrom: e.target.value, customTo });
            }}
          />
          <TextInput
            aria-label="Default range to date"
            type="date"
            className="!py-2 text-sm"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setDefaultDateRangeSetting({ preset: "custom", customFrom, customTo: e.target.value });
            }}
          />
        </div>
      )}
      <p className="text-[11px] leading-snug text-neutral-400">
        Starting range for Daybook, statements, and insurance reports.
      </p>
    </div>
  );
}
