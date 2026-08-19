"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string };

export function Select({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  placeholder = "Chọn...",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ term: "", at: 0 });
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openList() {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === value);
    setActiveIndex(index < 0 ? 0 : index);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  }
  function moveBy(step: number) {
    if (!options.length) return;
    setActiveIndex((current) => {
      const next = current + step;
      return next < 0 ? 0 : next > options.length - 1 ? options.length - 1 : next;
    });
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Đang mở thì Escape chỉ đóng danh sách, không đóng modal bên ngoài.
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveBy(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveBy(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(activeIndex);
      return;
    }
    if (event.key.length === 1) {
      const now = Date.now();
      const term =
        (now - typeahead.current.at < 600 ? typeahead.current.term : "") +
        event.key.toLowerCase();
      typeahead.current = { term, at: now };
      const index = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(term),
      );
      if (index >= 0) setActiveIndex(index);
    }
  }

  return (
    <div className="select-root" ref={rootRef}>
      <button
        type="button"
        className="select-trigger"
        ref={triggerRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="select-value">
          {selected ? selected.label : placeholder}
        </span>
        {selected?.hint && <span className="select-hint">{selected.hint}</span>}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="select-content"
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => (
            <div
              className="select-item"
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commit(index)}
            >
              <span className="select-item-check">
                {option.value === value && <Check size={14} />}
              </span>
              <span className="select-item-label">{option.label}</span>
              {option.hint && (
                <span className="select-item-hint">{option.hint}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
