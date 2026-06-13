"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, X, ChevronDown, Package } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  cost_price?: number | null;
  selling_price?: number | null;
  currentStock?: number;
  reorderPoint?: number;
}

interface Props {
  products: ProductOption[];
  value: string;                                          // selected product_id
  onChange: (id: string, product: ProductOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  isOutbound?: boolean;                                   // enables stock-out validation UI
}

const MAX_RESULTS = 50;

// ── Inline text highlight ─────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded-[2px] not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function fmt(n: number | null | undefined) {
  return n != null ? `₹${n.toLocaleString("en-IN")}` : "—";
}

// ── Component ─────────────────────────────────────────────────
export function ProductCombobox({ products, value, onChange, placeholder = "Search name, SKU, brand, model…", disabled, error, isOutbound }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => products.find(p => p.id === value) ?? null, [products, value]);

  // ── Filter ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, MAX_RESULTS);
    const q = query.toLowerCase().trim();
    return products.filter(p =>
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q)
    ).slice(0, MAX_RESULTS);
  }, [products, query]);

  useEffect(() => { setActiveIdx(0); }, [filtered]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // ── Handlers ─────────────────────────────────────────────────
  function openBox() {
    if (disabled) return;
    setQuery("");
    setActiveIdx(0);
    setOpen(true);
    // defer focus so the input renders first
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(p: ProductOption) {
    onChange(p.id, p);
    setOpen(false);
    setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("", null);
    setQuery("");
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIdx]) pick(filtered[activeIdx]);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  // ── Stock status helpers ──────────────────────────────────────
  function stockStatus(p: ProductOption): { label: string; color: string } {
    const s = p.currentStock ?? 0;
    if (s === 0)                                return { label: "Out of Stock", color: "text-red-600" };
    if (p.reorderPoint && s <= p.reorderPoint) return { label: `Low Stock: ${s}`, color: "text-yellow-600" };
    return { label: `Stock: ${s}`, color: "text-emerald-700" };
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Trigger / Search input ──────────────────────────── */}
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
            <button type="button" tabIndex={-1} onClick={() => setQuery("")} className="shrink-0">
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
            "w-full h-9 flex items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm shadow-sm",
            "hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 text-left",
            error && "border-destructive",
          )}
        >
          <span className={cn("truncate flex-1", !value && "text-muted-foreground")}>
            {selected ? (
              <>
                <span className="font-mono text-[11px] text-muted-foreground">{selected.sku}</span>
                {" "}
                <span>{selected.name}</span>
              </>
            ) : placeholder}
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

      {/* ── Dropdown ────────────────────────────────────────── */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-[200] left-0 right-0 top-[calc(100%+4px)] max-h-64 overflow-y-auto rounded-md border bg-popover shadow-lg text-popover-foreground"
        >
          {filtered.length === 0 ? (
            <li className="flex flex-col items-center gap-1 py-6 text-sm text-muted-foreground">
              <Package className="h-5 w-5" />
              {query ? `No results for "${query}"` : "No products found"}
            </li>
          ) : (
            <>
              {products.length > MAX_RESULTS && !query.trim() && (
                <li className="px-3 py-1 text-[10px] text-muted-foreground border-b bg-muted/40 select-none">
                  Showing {MAX_RESULTS} of {products.length} — type to search
                </li>
              )}
              {filtered.map((p, i) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={p.id === value}
                  data-idx={i}
                  onMouseDown={e => { e.preventDefault(); pick(p); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "cursor-pointer px-3 py-2 select-none",
                    i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
                    p.id === value && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: SKU + Name + Brand */}
                    <div className="min-w-0 flex-1">
                      <span className="block font-mono text-[11px] text-muted-foreground leading-tight">
                        <Highlight text={p.sku} query={query} />
                      </span>
                      <span className="block text-sm font-medium leading-snug truncate">
                        <Highlight text={p.name} query={query} />
                      </span>
                      {p.brand && (
                        <span className="block text-[11px] text-muted-foreground leading-tight">
                          <Highlight text={p.brand} query={query} />
                          {p.category && <span className="opacity-60"> · {p.category}</span>}
                        </span>
                      )}
                    </div>
                    {/* Right: Stock */}
                    {p.currentStock !== undefined && (() => {
                      const { label, color } = stockStatus(p);
                      return (
                        <span className={cn("text-xs font-semibold shrink-0 mt-0.5", color)}>
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      )}

      {/* ── Selected product details panel ──────────────────── */}
      {selected && !open && (
        <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground mb-0.5">Current Stock</p>
              {(() => {
                const { label, color } = stockStatus(selected);
                return (
                  <p className={cn("font-semibold text-sm", color)}>
                    {selected.currentStock ?? "—"}
                    {isOutbound && selected.currentStock === 0 && (
                      <span className="ml-1 text-[10px] font-normal text-red-500">⚠ {label}</span>
                    )}
                  </p>
                );
              })()}
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Reorder Level</p>
              <p className="font-medium text-sm">{selected.reorderPoint ?? "—"}</p>
            </div>
            {selected.category && (
              <div>
                <p className="text-muted-foreground mb-0.5">Category</p>
                <p className="font-medium text-sm truncate">{selected.category}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground mb-0.5">Selling Price</p>
              <p className="font-medium text-sm">{fmt(selected.selling_price)}</p>
            </div>
            {selected.cost_price != null && (
              <div>
                <p className="text-muted-foreground mb-0.5">Cost Price</p>
                <p className="font-medium text-sm">{fmt(selected.cost_price)}</p>
              </div>
            )}
            {selected.brand && (
              <div>
                <p className="text-muted-foreground mb-0.5">Brand</p>
                <p className="font-medium text-sm">{selected.brand}</p>
              </div>
            )}
          </div>
          {isOutbound && selected.currentStock !== undefined && selected.currentStock > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground border-t pt-1.5">
              Available to dispatch: <span className="font-semibold text-foreground">{selected.currentStock}</span> units
            </p>
          )}
        </div>
      )}
    </div>
  );
}
