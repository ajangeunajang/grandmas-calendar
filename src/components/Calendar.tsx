"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import AuthPanel from "@/components/AuthPanel";
import EventForm from "@/components/EventForm";
import Footer from "@/components/Footer";
import { WEEKDAYS, formatDateLabel, fromKey, getMonthGrid, toKey } from "@/lib/date";
import { COLOR_STYLES, sortEvents, useEvents, type CalendarEvent } from "@/lib/events";

const noop = () => () => {};

// "오늘"은 빌드/서버 시점이 아닌 브라우저 시간 기준이어야 하므로 클라이언트에서만 렌더
export default function Calendar() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <CalendarView /> : null;
}

// 보이는 건 -1·0·+1, 바깥 ±2·±3은 슬라이드 시 자연스럽게 들어오도록 화면 밖에 대기
const MONTH_WINDOW = [-3, -2, -1, 0, 1, 2, 3];
const WHEEL_THRESHOLD = 40; // 이 정도 누적 스크롤이면 한 달 이동
const WHEEL_MIN_LOCK = 450; // 이동 후 최소 잠금 시간 = 슬라이드 애니메이션 길이 (ms)
const WHEEL_GESTURE_GAP = 200; // 이만큼 스크롤 입력이 끊겨야 새 제스처로 인정 (트랙패드 관성 대응)

/** year*12 + month 형태의 월 인덱스 */
const toIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();

/** 달력 범위: 2026년 1월 ~ 2027년 3월 — 범위 밖으로는 이동하지 않음 */
const START_YEAR = 2026;
const END_YEAR = 2027;
const MIN_INDEX = START_YEAR * 12; // 2026-01
const MAX_INDEX = END_YEAR * 12 + 2; // 2027-03
const inRange = (index: number) => index >= MIN_INDEX && index <= MAX_INDEX;

function CalendarView() {
  const today = new Date();
  const todayKey = toKey(today);
  const [current, setCurrent] = useState(() => toIndex(today));
  const [leaving, setLeaving] = useState<{ index: number; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState(todayKey);
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const { events, addEvent, updateEvent, deleteEvent } = useEvents();
  const wheel = useRef({ acc: 0, locked: false, movedAt: 0, lastEvent: 0 });

  const year = Math.floor(current / 12);
  const dir = leaving?.dir ?? 1;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    for (const [k, v] of map) map.set(k, sortEvents(v));
    return map;
  }, [events]);

  const selectedEvents = eventsByDate.get(selected) ?? [];

  const goTo = (target: number) => {
    const next = Math.min(Math.max(target, MIN_INDEX), MAX_INDEX);
    if (next === current) return;
    setLeaving({ index: current, dir: next > current ? 1 : -1 });
    setCurrent(next);
  };
  const goToday = () => {
    goTo(toIndex(today));
    setSelected(todayKey);
  };

  // 상하 스크롤(트랙패드 좌우 스와이프 포함) → 이전/다음 달
  const onWheel = (e: React.WheelEvent) => {
    const w = wheel.current;
    const now = Date.now();
    const newGesture = now - w.lastEvent > WHEEL_GESTURE_GAP;
    w.lastEvent = now;

    // 한 번 이동하면, 관성 스크롤이 완전히 멈추고(입력 끊김) 애니메이션도 끝나야 다시 이동
    if (w.locked) {
      if (!newGesture || now - w.movedAt < WHEEL_MIN_LOCK) return;
      w.locked = false;
    }
    if (newGesture) w.acc = 0;

    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    w.acc += delta;
    if (Math.abs(w.acc) < WHEEL_THRESHOLD) return;
    goTo(current + (w.acc > 0 ? 1 : -1));
    w.acc = 0;
    w.locked = true;
    w.movedAt = now;
  };

  const gridProps = {
    eventsByDate,
    selected,
    todayKey,
    onSelect: (date: Date) => {
      setSelected(toKey(date));
      setEditing(null);
      goTo(toIndex(date));
    },
    onAdd: (date: Date) => {
      setSelected(toKey(date));
      setEditing("new");
    },
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:flex-row md:p-8">
      {/* 월간 그리드 */}
      <section className="flex flex-1 flex-col">
        <header className="mb-4 flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div />
            <div className="flex items-center gap-1">
              <NavButton onClick={() => goTo(current - 12)} label="이전 해" disabled={year <= START_YEAR}>‹</NavButton>
              <h1 className="text-xl font-semibold tabular-nums tracking-tight">{year}</h1>
              <NavButton onClick={() => goTo(current + 12)} label="다음 해" disabled={year >= END_YEAR}>›</NavButton>
            </div>
            <button
              onClick={goToday}
              className="justify-self-end border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Today
            </button>
          </div>

          {/* 이전·현재·다음 달 — 현재 달은 가운데(굵게), 이동 시 좌우로 슬라이드 */}
          <nav className="relative h-[1.5em] overflow-hidden text-[clamp(2.75rem,6.5vw,6.5rem)] leading-none">
            {MONTH_WINDOW.map((offset) => {
              const index = current + offset;
              if (!inRange(index)) return null;
              const m = index % 12;
              const active = offset === 0;
              const isTodayMonth = index === toIndex(today);
              return (
                <button
                  key={index}
                  onClick={() => goTo(index)}
                  aria-current={active ? "date" : undefined}
                  tabIndex={Math.abs(offset) > 1 ? -1 : undefined}
                  className={`absolute inset-y-0 flex w-1/3 items-center justify-center tracking-tighter tabular-nums transition-[left,color] duration-300 ease-out ${
                    active
                      ? "font-bold text-zinc-900 dark:text-white"
                      : "font-light text-zinc-300 hover:text-zinc-500 dark:text-zinc-700 dark:hover:text-zinc-500"
                  }`}
                  style={{ left: `${((offset + 1) * 100) / 3}%` }}
                >
                  <span className="relative">
                    {String(m + 1).padStart(2, "0")}
                    {isTodayMonth && (
                      <span className="absolute top-0 -right-[0.2em] h-[0.14em] w-[0.14em] rounded-full bg-red-500" />
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* 요일 — 라운드 테두리, 테두리 색은 글자색(border-current)을 따름 */}
        <div className="grid grid-cols-7 gap-[0.2em] pb-[0.25em] text-center text-[clamp(1.5rem,3vw,3rem)] font-semibold tracking-tight text-zinc-900 dark:text-white">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`rounded-[0.3em] border border-current py-[0.1em] ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 슬라이딩 영역: 나가는 달과 들어오는 달을 겹쳐서 애니메이션 */}
        <div onWheel={onWheel} className="relative flex flex-1 overflow-hidden">
          {leaving && (
            <MonthGrid
              key={`out-${leaving.index}`}
              index={leaving.index}
              {...gridProps}
              className={`pointer-events-none absolute inset-0 ${
                dir > 0 ? "animate-slide-out-left" : "animate-slide-out-right"
              }`}
              onAnimationEnd={() => setLeaving(null)}
            />
          )}
          <MonthGrid
            key={current}
            index={current}
            {...gridProps}
            className={`flex-1 ${leaving ? (dir > 0 ? "animate-slide-in-right" : "animate-slide-in-left") : ""}`}
          />
        </div>
      </section>

      {/* 선택한 날짜 상세 */}
      <aside className="flex w-full flex-col gap-4 md:w-80">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tabular-nums">{formatDateLabel(fromKey(selected))}</h2>
          {editing === null && (
            <button
              onClick={() => setEditing("new")}
              aria-label="일정 추가"
              className="bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              +
            </button>
          )}
        </div>

        {editing === "new" && (
          <EventForm
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              addEvent({ ...data, date: selected });
              setEditing(null);
            }}
          />
        )}

        <ul className="flex flex-col gap-2">
          {selectedEvents.length === 0 && editing !== "new" && (
            <li className="text-sm text-zinc-500">일정이 없어요. 날짜를 더블클릭해도 추가할 수 있어요.</li>
          )}
          {selectedEvents.map((e) =>
            editing !== "new" && editing?.id === e.id ? (
              <li key={e.id}>
                <EventForm
                  initial={e}
                  onCancel={() => setEditing(null)}
                  onSubmit={(data) => {
                    updateEvent({ ...e, ...data });
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={e.id}
                className="group flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_STYLES[e.color].dot}`} />
                <button onClick={() => setEditing(e)} className="flex flex-1 flex-col text-left">
                  <span className="text-sm font-medium">{e.title}</span>
                  <span className="text-xs text-zinc-500">{e.time ?? "하루 종일"}</span>
                </button>
                <button
                  onClick={() => deleteEvent(e.id)}
                  aria-label="삭제"
                  className="text-zinc-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ),
          )}
        </ul>

        {/* 사이드바 하단 푸터 */}
        {/* 사이드바 하단: 로그인 + 푸터 */}
        <div className="mt-auto flex flex-col gap-4">
          <AuthPanel />
          <Footer title="Grandma's Calendar" />
        </div>
      </aside>
    </div>
  );
}

function NavButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-zinc-100 disabled:invisible dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

interface MonthGridProps {
  index: number;
  eventsByDate: Map<string, CalendarEvent[]>;
  selected: string;
  todayKey: string;
  onSelect: (date: Date) => void;
  onAdd: (date: Date) => void;
  className?: string;
  onAnimationEnd?: () => void;
}

function MonthGrid({ index, eventsByDate, selected, todayKey, onSelect, onAdd, className, onAnimationEnd }: MonthGridProps) {
  const year = Math.floor(index / 12);
  const month = index % 12;
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  return (
    <div className={`grid grid-cols-7 grid-rows-6 ${className ?? ""}`} onAnimationEnd={onAnimationEnd}>
      {grid.map((date) => {
        const key = toKey(date);
        const inMonth = date.getMonth() === month;
        const dayEvents = eventsByDate.get(key) ?? [];
        const isSelected = key === selected;
        const isToday = key === todayKey;
        const dow = date.getDay();
        const outOfRange = !inRange(toIndex(date)); // 처음·마지막 달 그리드 앞뒤의 범위 밖 날짜

        return (
          <button
            key={key}
            onClick={() => onSelect(date)}
            onDoubleClick={() => onAdd(date)}
            disabled={outOfRange}
            className={`relative flex min-h-20 items-center justify-center rounded-[0.3em] p-1.5 transition-colors ${
              isSelected ? "bg-zinc-100 dark:bg-zinc-800/70" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            } ${inMonth ? "" : "opacity-20"} ${outOfRange ? "invisible" : ""}`}
          >
            <span
              className={`relative text-[clamp(1.5rem,3.4vw,3.75rem)] font-medium tracking-tighter tabular-nums ${
                dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : ""
              }`}
            >
              {date.getDate()}
              {/* 오늘 — 월 표시와 같은 빨간 점 */}
              {isToday && (
                <span className="absolute top-0 -right-[0.25em] size-[calc(clamp(2.75rem,6.5vw,6.5rem)*0.14)] rounded-full bg-red-500" />
              )}
            </span>
            {/* 일정이 있는 날 — 칸 아래쪽을 가로지르는 파란 선 */}
            {dayEvents.length > 0 && (
              <span
                title={dayEvents.map((e) => e.title).join(", ")}
                className="absolute inset-x-2 bottom-2 h-1 bg-blue-500"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
