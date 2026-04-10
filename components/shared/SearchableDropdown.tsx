'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Generic searchable dropdown with click-outside dismiss.
 * Used for trail selection (EditTrailContent) and network selection (EditNetworkContent).
 *
 * T must have a string `id` field so the component can track selection identity.
 */
export function SearchableDropdown<T extends { id: string }>({
  items,
  selectedItem,
  onSelect,
  onClear,
  getSearchText,
  renderItem,
  renderSideAction,
  placeholder,
  inputCls,
}: {
  items: T[]
  selectedItem: T | null
  onSelect: (item: T) => void
  onClear: () => void
  /** Text used to filter items against the search query. */
  getSearchText: (item: T) => string
  /** Renders each list item's main (select) cell content. */
  renderItem: (item: T, isSelected: boolean) => React.ReactNode
  /** Optional trailing control per row (e.g. icon button). Receives `close` to dismiss the list. */
  renderSideAction?: (item: T, close: () => void) => React.ReactNode
  placeholder: string
  /** Tailwind class string for the text input. */
  inputCls: string
}) {
  const [query, setQuery] = useState(selectedItem ? getSearchText(selectedItem) : '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync input when selection changes externally (e.g. map pick, clear, or mode exit)
  useEffect(() => {
    if (selectedItem) {
      setQuery(getSearchText(selectedItem))
    } else {
      setQuery('')
    }
    setOpen(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.id])

  const filtered = query.trim()
    ? items.filter((item) => getSearchText(item).toLowerCase().includes(query.toLowerCase()))
    : items

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (item: T) => {
    onSelect(item)
    setQuery(getSearchText(item))
    setOpen(false)
  }

  const handleClear = () => {
    onClear()
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-1">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className={inputCls}
        />
        {selectedItem && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 rounded border border-border text-muted-foreground text-xs hover:border-red-300 hover:text-destructive transition-colors"
            title="Clear selection"
          >
            ✕
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-md">
          {filtered.map((item) => {
            const side =
              renderSideAction?.(item, () => setOpen(false)) ?? null
            return (
              <li
                key={item.id}
                className="flex min-h-0 items-stretch border-b border-border/60 last:border-b-0"
              >
                <button
                  type="button"
                  onMouseDown={() => handleSelect(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  {renderItem(item, selectedItem?.id === item.id)}
                </button>
                {side ? (
                  <div className="flex shrink-0 items-center border-l border-border/50 px-1">
                    {side}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {open && query.trim() !== '' && filtered.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-md px-3 py-2 text-xs text-muted-foreground">
          No results match &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
