export function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

export function toDateTimeDisplay(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
export function toDateDisplayWithWeekday(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${toDateInputValue(d)}（${WEEKDAYS[d.getDay()]}）`;
}

export function currentYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function yearMonthToRange(yearMonth: string): { start: Date; end: Date } {
  const [yStr, mStr] = yearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

export function daysInYearMonth(yearMonth: string): string[] {
  const [yStr, mStr] = yearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(y, m, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${yStr}-${mStr}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

export function splitDestinations(destination: string): string[] {
  return destination.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
}

export function joinDestinations(list: string[]): string {
  return list.map((s) => s.trim()).filter((s) => s.length > 0).join("\n");
}

export function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatMeter(value: number): string {
  return `${value.toLocaleString("ja-JP")} km`;
}
