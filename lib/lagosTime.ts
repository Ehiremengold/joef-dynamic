// Exam times are entered and shown in Lagos time, whatever the device's own
// time zone. Nigeria keeps West Africa Time (UTC+1) all year, no daylight
// saving, so the conversion is a fixed hour.
const OFFSET = "+01:00";
const OFFSET_MS = 60 * 60 * 1000;

/** "2026-10-20T09:00" typed in a datetime-local box, as Lagos time → ISO. */
export function lagosInputToIso(value: string): string | null {
  if (!value) return null;
  const t = Date.parse(`${value}:00${OFFSET}`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** An ISO time → the "YYYY-MM-DDTHH:mm" a datetime-local box shows, in Lagos time. */
export function isoToLagosInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(Date.parse(iso) + OFFSET_MS).toISOString().slice(0, 16);
}

/** "12 Oct 2026 · 10:00 AM", in Lagos time: how an exam's date and time is shown everywhere. */
export function formatExamTime(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.day} ${parts.month} ${parts.year} · ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()}`;
}
