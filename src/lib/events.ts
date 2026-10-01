import { useSyncExternalStore } from "react";

export type EventColor = "blue" | "green" | "red" | "yellow" | "purple";

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time?: string; // HH:mm
  color: EventColor;
}

export const COLOR_STYLES: Record<EventColor, { dot: string; chip: string }> = {
  blue: { dot: "bg-blue-500", chip: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200" },
  green: { dot: "bg-green-500", chip: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200" },
  red: { dot: "bg-red-500", chip: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200" },
  yellow: { dot: "bg-yellow-400", chip: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200" },
  purple: { dot: "bg-purple-500", chip: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200" },
};

const STORAGE_KEY = "eunas-calendar:events";
const EMPTY: CalendarEvent[] = [];

// localStorage 기반의 아주 작은 외부 스토어 (SSR 안전)
let cache: CalendarEvent[] | null = null;
const listeners = new Set<() => void>();

function read(): CalendarEvent[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: CalendarEvent[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패는 무시 (시크릿 모드 등)
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEvents() {
  const events = useSyncExternalStore(subscribe, read, () => EMPTY);

  return {
    events,
    addEvent: (event: Omit<CalendarEvent, "id">) =>
      write([...read(), { ...event, id: crypto.randomUUID() }]),
    updateEvent: (event: CalendarEvent) =>
      write(read().map((e) => (e.id === event.id ? event : e))),
    deleteEvent: (id: string) => write(read().filter((e) => e.id !== id)),
  };
}

/** 시간 없는 일정 먼저, 그 다음 시간순 */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}
