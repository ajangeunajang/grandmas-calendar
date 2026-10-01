export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** Date → "YYYY-MM-DD" (local time) */
export function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → Date (local time) */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 해당 월을 6주(42칸) 그리드로 반환 — 앞뒤 달 날짜 포함 */
export function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from(
    { length: 42 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/** Date → "2026-10-01-木" */
export function formatDateLabel(date: Date): string {
  return `${toKey(date)}-${WEEKDAYS[date.getDay()]}`;
}
