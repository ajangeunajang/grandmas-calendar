import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUser, subscribeAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export type EventColor = "blue" | "green" | "red" | "yellow" | "purple";

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time?: string; // HH:mm
  color: EventColor;
  done?: boolean;
}

export const COLOR_STYLES: Record<EventColor, { dot: string; border: string }> = {
  blue: { dot: "bg-blue-500", border: "border-blue-500" },
  green: { dot: "bg-green-500", border: "border-green-500" },
  red: { dot: "bg-red-500", border: "border-red-500" },
  yellow: { dot: "bg-yellow-400", border: "border-yellow-400" },
  purple: { dot: "bg-purple-500", border: "border-purple-500" },
};

const STORAGE_KEY = "eunas-calendar:events";
const EMPTY: CalendarEvent[] = [];

/*
 * 일정 스토어
 * - 로그아웃: 이 브라우저의 localStorage에 저장
 * - 로그인: Supabase `events` 테이블에 저장 → 어느 기기에서든 같은 일정
 *   (처음 로그인할 때 이 브라우저에 있던 일정은 계정으로 옮김)
 * 화면은 즉시 바뀌고(낙관적 업데이트), 서버 저장이 실패하면 서버 기준으로 다시 불러옴
 */
type Mode = { kind: "local" } | { kind: "remote"; userId: string };

let mode: Mode = { kind: "local" };
let cache: CalendarEvent[] | null = null;
let started = false;
const listeners = new Set<() => void>();

interface EventRow {
  id: string;
  user_id: string;
  date: string;
  title: string;
  time: string | null;
  color: EventColor;
  done: boolean;
}

const toRow = (e: CalendarEvent, userId: string): EventRow => ({
  id: e.id,
  user_id: userId,
  date: e.date,
  title: e.title,
  time: e.time ?? null,
  color: e.color,
  done: e.done ?? false,
});

const fromRow = (r: EventRow): CalendarEvent => ({
  id: r.id,
  date: r.date,
  title: r.title,
  time: r.time ?? undefined,
  color: r.color,
  done: r.done ?? false,
});

function readLocal(): CalendarEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocal(next: CalendarEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패는 무시 (시크릿 모드 등)
  }
}

function setCache(next: CalendarEvent[]) {
  cache = next;
  listeners.forEach((l) => l());
}

function current(): CalendarEvent[] {
  if (cache) return cache;
  if (mode.kind === "remote") return EMPTY;
  cache = readLocal();
  return cache;
}

async function loadRemote(userId: string) {
  const sb = getSupabase();
  if (!sb) return;

  const local = readLocal();
  if (local.length > 0) {
    const { error } = await sb.from("events").upsert(local.map((e) => toRow(e, userId)));
    if (!error) writeLocal([]);
    else console.error("일정 옮기기 실패", error);
  }

  const { data, error } = await sb.from("events").select("*");
  if (error) return console.error("일정 불러오기 실패", error);
  // 불러오는 사이 로그아웃·계정 변경이 있었다면 무시
  if (mode.kind === "remote" && mode.userId === userId) setCache((data as EventRow[]).map(fromRow));
}

function onAuthChange() {
  const user = getUser();
  if (user === undefined) return; // 아직 확인 중
  if (user) {
    if (mode.kind === "remote" && mode.userId === user.id) return;
    mode = { kind: "remote", userId: user.id };
    setCache(EMPTY);
    loadRemote(user.id);
  } else {
    if (mode.kind === "local") return;
    mode = { kind: "local" };
    setCache(readLocal());
  }
}

function start() {
  if (started) return;
  started = true;
  subscribeAuth(onAuthChange);
  onAuthChange();
  // 다른 기기에서 바꾼 일정 반영 — 탭으로 돌아올 때마다 다시 불러옴
  window.addEventListener("focus", () => {
    if (mode.kind === "remote") loadRemote(mode.userId);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type RemoteOp = (sb: SupabaseClient, userId: string) => PromiseLike<{ error: unknown }>;

function mutate(next: CalendarEvent[], remoteOp: RemoteOp) {
  setCache(next);
  if (mode.kind === "local") return writeLocal(next);

  const { userId } = mode;
  const sb = getSupabase();
  if (!sb) return;
  remoteOp(sb, userId).then(({ error }) => {
    if (!error) return;
    console.error("일정 저장 실패", error);
    loadRemote(userId);
  });
}

export function useEvents() {
  const events = useSyncExternalStore(subscribe, current, () => EMPTY);

  return {
    events,
    addEvent: (data: Omit<CalendarEvent, "id">) => {
      const event = { ...data, id: crypto.randomUUID() };
      mutate([...current(), event], (sb, userId) => sb.from("events").insert(toRow(event, userId)));
    },
    updateEvent: (event: CalendarEvent) =>
      mutate(
        current().map((e) => (e.id === event.id ? event : e)),
        (sb, userId) => sb.from("events").update(toRow(event, userId)).eq("id", event.id),
      ),
    toggleDone: (event: CalendarEvent) => {
      const next = { ...event, done: !event.done };
      mutate(
        current().map((e) => (e.id === event.id ? next : e)),
        (sb) => sb.from("events").update({ done: next.done }).eq("id", event.id),
      );
    },
    deleteEvent: (id: string) =>
      mutate(
        current().filter((e) => e.id !== id),
        (sb) => sb.from("events").delete().eq("id", id),
      ),
  };
}

/** 시간 없는 일정 먼저, 그 다음 시간순 (완료 여부와 상관없이 순서 고정) */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}
