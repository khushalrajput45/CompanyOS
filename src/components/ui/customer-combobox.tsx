"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, X, ChevronDown, Users } from "lucide-react";

export interface CustomerOption {
  id: string;
  name: string;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  gst_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  shipping_address?: { line1: string; line2?: string | null; city: string; state: string; pincode: string } | null;
}

interface Props {
  customers: CustomerOption[];
  value: string;
  onChange: (id: string, customer: CustomerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

const MAX_RESULTS = 50;

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded-[2px] not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CustomerCombobox({
  customers,
  value,
  onChange,
  placeholder = "Search customer name or company…",
  disabled,
  error,
}: Props) {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => customers.find(c => c.id === value) ?? null, [customers, value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers.slice(0, MAX_RESULTS);
    const q = query.toLowerCase().trim();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company_name ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    ).slice(0, MAX_RESULTS);
  }, [customers, query]);

  useEffect(() => { setActiveIdx(0); }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  function openBox() {
    if (disabled) return;
    setQuery(""); setActiveIdx(0); setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(c: CustomerOption) {
    onChange(c.id, c);
    setOpen(false); setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("", null); setQuery("");
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); break;
      case "ArrowUp":   e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); break;
      case "Enter":     e.preventDefault(); if (filtered[activeIdx]) pick(filtered[activeIdx]); break;
      case "Escape":    e.preventDefault(); setOpen(false); break;
      case "Tab":       setOpen(false); break;
    }
  }

  const displayLabel = selected
    ? selected.company_name
      ? `${selected.name} — ${selected.company_name}`
      : selected.name
    : null;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger / Search */}
      {open ? (
        <div className="flex items-center gap-2 h-9 rounded-md border-2 border-primary bg-background px-3 text-sm shadow-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground min-w-0"
          />
          {query && (
            <button type="button" tabIndex={-1} onClick={() => setQuery("")}>
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openBox}
          className={cn(
            "w-full h-9 flex items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm shadow-sm text-left",
            "hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive",
          )}
        >
          <span className={cn("truncate flex-1", !value && "text-muted-foreground")}>
            {displayLabel ?? placeholder}
          </span>
          <div className="shrink-0 flex items-center gap-1">
            {value && !disabled && (
              <span role="button" onClick={clear} className="rounded hover:bg-muted p-0.5">
                <X className="h-3 w-3 text-muted-foreground" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-[200] left-0 right-0 top-[calc(100%+4px)] max-h-64 overflow-y-auto rounded-md border bg-popover shadow-lg text-popover-foreground"
        >
          {filtered.length === 0 ? (
            <li className="flex flex-col items-center gap-1 py-6 text-sm text-muted-foreground">
              <Users className="h-5 w-5" />
              {query ? `No results for "${query}"` : "No customers found"}
            </li>
          ) : (
            <>
              {customers.length > MAX_RESULTS && !query.trim() && (
                <li className="px-3 py-1 text-[10px] text-muted-foreground border-b bg-muted/40 select-none">
                  Showing {MAX_RESULTS} of {customers.length} — type to search
                </li>
              )}
              {filtered.map((c, i) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={c.id === value}
                  data-idx={i}
                  onMouseDown={e => { e.preventDefault(); pick(c); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "cursor-pointer px-3 py-2 select-none",
                    i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
                    c.id === value && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-sm font-medium leading-snug">
                        <Highlight text={c.name} query={query} />
                      </span>
                      {c.company_name && (
                        <span className="block text-[11px] text-muted-foreground">
                          <Highlight text={c.company_name} query={query} />
                        </span>
                      )}
                    </div>
                    {(c.city || c.state) && (
                      <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                        {[c.city, c.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      )}

      {/* Selected customer info strip */}
      {selected && !open && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 px-1 text-[11px] text-muted-foreground">
          {selected.phone && <span>📞 {selected.phone}</span>}
          {selected.email && <span>✉ {selected.email}</span>}
          {selected.gst_number && <span className="font-mono">GST: {selected.gst_number}</span>}
        </div>
      )}
    </div>
  );
}
