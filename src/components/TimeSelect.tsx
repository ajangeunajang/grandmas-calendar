"use client";

import { useEffect, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  ariaLabel: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  columns: number;
  disabled?: boolean;
  /** 격자 위에 한 줄로 따로 두는 옵션 (예: 하루 종일) */
  extra?: Option;
}

/**
 * 네이티브 <select> 대신 쓰는 시·분 선택 — 누르면 숫자 격자가 펼쳐짐
 * (네이티브 드롭다운 목록은 OS가 그려서 스타일을 바꿀 수 없음)
 */
export default function TimeSelect({ ariaLabel, value, options, onChange, columns, disabled, extra }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex min-w-10 items-center justify-between gap-1 border-b px-1 py-1 text-sm tabular-nums disabled:opacity-40 ${
          open ? "border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        {[extra, ...options].find((o) => o?.value === value)?.label ?? value}
        <span aria-hidden className="font-symbol text-[0.6em] text-zinc-400">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute top-full left-0 z-20 mt-1 w-max border border-zinc-900 bg-background p-1 dark:border-white"
        >
          {extra && (
            <OptionCell option={extra} selected={value === extra.value} onSelect={select} className="mb-1 w-full" />
          )}
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${columns}, auto)` }}>
            {options.map((o) => (
              <OptionCell key={o.value} option={o} selected={value === o.value} onSelect={select} className="w-9" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionCell({
  option,
  selected,
  onSelect,
  className,
}: {
  option: Option;
  selected: boolean;
  onSelect: (value: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(option.value)}
      className={`py-1.5 text-sm tabular-nums ${className ?? ""} ${
        selected
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {option.label}
    </button>
  );
}
