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
  placeholder,
  inputCls,
}: {
  items: T[]
  selectedItem: T | null
  onSelect: (item: T) => void
  onClear: () => void
  /** Text used to filter items against the search query. */
  getSearchText: (item: T) => string
  /** Renders each list item button's content. */
  renderItem: (item: T, isSelected: boolean) => React.ReactNode
  placeholder: string
  /** Tailwind class string for the text input. */
  inputCls: string
}) {
  const [query, setQuery] = useState(selectedItem ? getSearchText(selectedItem) : '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync input when item is selected externally (e.g. map click)
  useEffect(() => {
    if (selectedItem) setQuery(getSearchText(selectedItem))
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
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(item)}
                className="w-full text-left"
              >
                {renderItem(item, selectedItem?.id === item.id)}
              </button>
            </li>
          ))}
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
