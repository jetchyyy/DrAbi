/**
 * MedicationCombobox
 *
 * Predictive-search combobox for the doctor's prescription / Clinical Findings
 * step.
 *
 * PRIMARY source — Philippine National Formulary (PNF) Essential Medicines List
 *   449 DOH-standard medicines bundled as static JSON.  Always searched.
 *   This is intentional: most patients are teleconsulting or buying from an
 *   external pharmacy, so clinic stock is irrelevant to the search itself.
 *
 * OPTIONAL annotation — Clinic Inventory (live via Supabase / local-db)
 *   If the clinic happens to stock a matched PNF medicine, a live stock badge
 *   is shown as a convenience indicator.  It never filters or ranks results.
 *
 * Badges:
 *   🔵 PNF listed — medicine is on the official formulary (default)
 *   🟢 In stock   — clinic pharmacy has stock
 *   🟡 Low stock  — at or below reorder level
 *   🔴 Out        — stocked but zero units remaining
 *
 * Keyboard: ↑ ↓ navigate · Enter select · Esc close
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  Search,
  Package2,
  X,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listInventoryItemsLiveOrDemo } from "../../lib/supabase-clinic";
import type { InventoryItem } from "../../types/domain";
import { cn } from "../../lib/utils";

// ─── PNF data (bundled static JSON) ────────────────────────────────────────
import pnfData from "../../data/pnf-medicines.json";

interface PnfEntry {
  name: string;
  routes: string[];
}

const PNF_LIST: PnfEntry[] = pnfData as PnfEntry[];

// ─── Result shape used inside the component ────────────────────────────────

type StockStatus = "ok" | "low" | "out" | "pnf_only";

interface SuggestionItem {
  /** Unique key for React */
  key: string;
  /** Generic / official name (from PNF or inventory) */
  name: string;
  /** Brand name from inventory (if available) */
  brandName?: string;
  /** Route + form strings from PNF, or unit from inventory */
  subtitle: string;
  /** Live stock count — undefined when not in inventory */
  stockOnHand?: number;
  stockStatus: StockStatus;
  /** Inventory record, if matched */
  inventoryItem?: InventoryItem;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function stockStatus(item: InventoryItem): StockStatus {
  if (item.stockOnHand <= 0) return "out";
  if (item.stockOnHand <= item.reorderLevel) return "low";
  return "ok";
}

/** Highlights all occurrences of `query` inside `text` */
function hl(text: string, query: string): (string | JSX.Element)[] {
  if (!query.trim()) return [text];
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "gi"));
  return parts.map((part, i) =>
    new RegExp(`^${esc}$`, "i").test(part) ? (
      <mark
        key={i}
        className="rounded-sm bg-[color-mix(in_srgb,var(--color-primary)_18%,white)] font-bold text-[var(--color-primary)] [background:none] underline decoration-[var(--color-primary)] decoration-2 underline-offset-1"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/**
 * Build suggestion list — PNF is the only source of results.
 * Inventory is used purely to annotate results with a stock badge.
 */
function buildSuggestions(
  query: string,
  inventory: InventoryItem[],
): SuggestionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SuggestionItem[] = [];

  for (const pnf of PNF_LIST) {
    const nameMatch  = pnf.name.toLowerCase().includes(q);
    const routeMatch = pnf.routes.some((r) => r.toLowerCase().includes(q));
    if (!nameMatch && !routeMatch) continue;

    // Optional: check if clinic stocks this medicine (pure annotation)
    const inv = inventory.find(
      (item) =>
        item.name.toLowerCase().includes(pnf.name.toLowerCase()) ||
        pnf.name.toLowerCase().includes(item.name.toLowerCase()),
    );

    results.push({
      key: `pnf-${pnf.name}`,
      name: pnf.name,
      brandName: inv?.brandName ?? undefined,
      subtitle: pnf.routes.slice(0, 2).join(" · "),
      stockOnHand: inv?.stockOnHand,
      // Without an inventory match the default badge is simply "PNF listed"
      stockStatus: inv ? stockStatus(inv) : "pnf_only",
      inventoryItem: inv,
    });
  }

  return results.slice(0, 12);
}

// ─── props ─────────────────────────────────────────────────────────────────

export interface MedicationComboboxProps {
  /**
   * Called when the doctor selects a suggestion.
   * Receives a human-readable prescription line and the raw inventory item
   * (if the selection was backed by inventory stock).
   */
  onSelect: (formattedLine: string, inventoryItem?: InventoryItem) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

// ─── component ─────────────────────────────────────────────────────────────

export function MedicationCombobox({
  onSelect,
  placeholder = "Search by name, brand, or form — PNF list + clinic inventory…",
  className,
  id = "medication-combobox",
}: MedicationComboboxProps) {
  const [query,       setQuery]       = useState("");
  const [isOpen,      setIsOpen]      = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);
  const rootRef  = useRef<HTMLDivElement>(null);

  // ── live inventory (cached for the session) ──────────────────────────────
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-items-all"],
    queryFn:  listInventoryItemsLiveOrDemo,
    staleTime: 60_000,
  });

  // ── derived suggestion list ──────────────────────────────────────────────
  const suggestions = buildSuggestions(query, inventory);

  // ── close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ── reset active index on new results ───────────────────────────────────
  useEffect(() => { setActiveIndex(-1); }, [query]);

  // ── scroll active item into view ─────────────────────────────────────────
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // ── selection handler ────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (item: SuggestionItem) => {
      const parts: string[] = [item.name];
      if (item.brandName) parts.push(`(${item.brandName})`);
      if (item.inventoryItem) {
        parts.push(`— ${item.inventoryItem.unit}`);
      } else if (item.subtitle) {
        // Take just the first route form as a concise hint
        const firstRoute = item.subtitle.split("·")[0].trim();
        parts.push(`— ${firstRoute}`);
      }
      const line = parts.join(" ");

      onSelect(line, item.inventoryItem);
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [onSelect],
  );

  // ── keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const showDropdown = isOpen && query.trim().length > 0;

  // ── stock badge styles & labels ──────────────────────────────────────────
  const badgeConfig: Record<StockStatus, { ring: string; bg: string; text: string; label: (n?: number) => string }> = {
    ok:       { ring: "ring-emerald-100",  bg: "bg-emerald-50",  text: "text-emerald-800", label: (n) => `${n} in stock` },
    low:      { ring: "ring-amber-100",    bg: "bg-amber-50",    text: "text-amber-800",   label: (n) => `${n} low` },
    out:      { ring: "ring-rose-100",     bg: "bg-rose-50",     text: "text-rose-800",    label: () => "Out of stock" },
    pnf_only: { ring: "ring-sky-100",      bg: "bg-sky-50",      text: "text-sky-800",     label: () => "PNF listed" },
  };

  const iconConfig: Record<StockStatus, { el: typeof CheckCircle2; wrap: string }> = {
    ok:       { el: CheckCircle2,   wrap: "bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-[var(--color-primary)] ring-[color-mix(in_srgb,var(--color-primary)_30%,white)]" },
    low:      { el: AlertTriangle,  wrap: "bg-amber-50 text-amber-600 ring-amber-100" },
    out:      { el: AlertTriangle,  wrap: "bg-rose-50 text-rose-600 ring-rose-100" },
    pnf_only: { el: BookOpen,       wrap: "bg-sky-50 text-sky-600 ring-sky-100" },
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {/* ── input ─────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={`${id}-listbox`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-700"
            onClick={() => { setQuery(""); setIsOpen(false); inputRef.current?.focus(); }}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* ── dropdown ──────────────────────────────────────────────────────── */}
      {showDropdown && (
        <div
          className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5"
          role="presentation"
        >
          {/* loading */}
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <span className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
              Loading inventory…
            </div>
          )}

          {/* no results */}
          {!isLoading && suggestions.length === 0 && (
            <div className="flex items-center gap-3 px-4 py-4">
              <Package2 className="size-5 shrink-0 text-slate-300" />
              <div>
                <p className="text-sm font-medium text-slate-700">Not found in PNF or inventory</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Type the medication name manually in the field below.
                </p>
              </div>
            </div>
          )}

          {/* source legend */}
          {suggestions.length > 0 && (
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-sky-600">
                <BookOpen className="size-3" /> Philippine National Formulary
              </span>
              <span className="text-[10px] text-slate-400">
                {suggestions.length} result{suggestions.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* result list */}
          {suggestions.length > 0 && (
            <ul
              ref={listRef}
              id={`${id}-listbox`}
              role="listbox"
              aria-label="Medication suggestions"
              className="max-h-72 divide-y divide-slate-100/80 overflow-y-auto py-1"
            >
              {suggestions.map((item, index) => {
                const isActive = index === activeIndex;
                const ic = iconConfig[item.stockStatus];
                const bc = badgeConfig[item.stockStatus];
                const Icon = ic.el;

                return (
                  <li
                    key={item.key}
                    id={`${id}-opt-${index}`}
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                      isActive
                        ? "bg-[color-mix(in_srgb,var(--color-primary)_10%,white)]"
                        : "hover:bg-slate-50",
                    )}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {/* icon */}
                    <div className={cn("flex shrink-0 items-center justify-center rounded-lg p-1.5 ring-1", ic.wrap)}>
                      <Icon className="size-4" />
                    </div>

                    {/* name + subtitle */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {hl(item.name, query)}
                      </p>
                      {(item.brandName || item.subtitle) && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {item.brandName && (
                            <span className="font-medium text-slate-700">
                              {hl(item.brandName, query)}{" "}
                            </span>
                          )}
                          {item.subtitle && (
                            <span className="text-slate-400">{item.subtitle}</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* stock / PNF badge */}
                    <span className={cn(
                      "shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                      bc.bg, bc.text, bc.ring,
                    )}>
                      {bc.label(item.stockOnHand)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* footer hint */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
              ↑↓ navigate · Enter select · Esc close · {PNF_LIST.length} DOH-listed medicines · stock badge shown when clinic carries item
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
