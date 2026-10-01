"use client";

import { useState } from "react";
import TimeSelect from "@/components/TimeSelect";
import { COLOR_STYLES, type CalendarEvent, type EventColor } from "@/lib/events";

interface Props {
  initial?: CalendarEvent;
  onSubmit: (data: { title: string; time?: string; color: EventColor }) => void;
  onCancel: () => void;
}

const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));
const HOURS = toOptions(Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))); // 00–23
const MINUTES = toOptions(["00", "10", "20", "30", "40", "50"]); // 10분 단위

/** "HH:mm" → [시, 10분 단위로 내린 분] */
function splitTime(time?: string): [string, string] {
  if (!time) return ["", "00"];
  const [h, m] = time.split(":");
  return [h, String(Math.floor(Number(m) / 10) * 10).padStart(2, "0")];
}

export default function EventForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [initialHour, initialMinute] = splitTime(initial?.time);
  const [hour, setHour] = useState(initialHour); // "" = 하루 종일
  const [minute, setMinute] = useState(initialMinute);
  const [color, setColor] = useState<EventColor>(initial?.color ?? "blue");

  return (
    <form
      className="flex flex-col gap-3 border border-zinc-200 p-3 dark:border-zinc-800"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({ title: title.trim(), time: hour ? `${hour}:${minute}` : undefined, color });
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="일정 제목"
        className="border-b border-zinc-300 bg-transparent px-0 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-white"
      />
      <div className="flex items-center gap-3">
        {/* 24시간제, 분은 10분 단위 */}
        <div className="flex items-center gap-1">
          <TimeSelect
            ariaLabel="시"
            value={hour}
            onChange={setHour}
            options={HOURS}
            extra={{ value: "", label: "하루 종일" }}
            columns={6}
          />
          {/* 하루 종일이면 분 선택은 숨김 */}
          {hour && (
            <>
              <span className="text-sm">:</span>
              <TimeSelect ariaLabel="분" value={minute} onChange={setMinute} options={MINUTES} columns={3} />
            </>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {(Object.keys(COLOR_STYLES) as EventColor[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={`size-3 ${COLOR_STYLES[c].dot} ${
                color === c ? "ring-1 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900" : ""
              }`}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          취소
        </button>
        <button
          type="submit"
          className="bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {initial ? "수정" : "추가"}
        </button>
      </div>
    </form>
  );
}
