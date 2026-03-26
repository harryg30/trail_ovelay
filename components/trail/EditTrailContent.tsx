'use client'

import type { Trail, TrimFormState } from '@/lib/types'
import { EditTrailForm } from '@/components/trail/EditTrailForm'
import { SearchableDropdown } from '@/components/shared/SearchableDropdown'

export function EditTrailContent({
  trails,
  selectedTrail,
  onSelectTrail,
  onUpdateTrail,
  onDeleteTrail,
  onEnterRefineMode,
}: {
  trails: Trail[]
  selectedTrail: Trail | null
  onSelectTrail: (trail: Trail | null) => void
  onUpdateTrail: (form: TrimFormState) => Promise<string | null>
  onDeleteTrail: () => Promise<string | null>
  onEnterRefineMode?: () => void
}) {
  const handleClear = () => onSelectTrail(null)

  const inputCls =
    'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-orange-400'

  return (
    <div className="flex flex-col gap-3">
      <SearchableDropdown
        items={trails}
        selectedItem={selectedTrail}
        onSelect={onSelectTrail}
        onClear={handleClear}
        getSearchText={(t) => t.name}
        renderItem={(trail, isSelected) => (
          <span className={`px-3 py-2 text-sm hover:bg-orange-50 flex items-center justify-between gap-2 ${isSelected ? 'bg-orange-50 text-orange-700' : 'text-zinc-800'}`}>
            <span className="truncate">{trail.name}</span>
            <span className="text-xs text-zinc-400 shrink-0">{trail.distanceKm.toFixed(1)} km</span>
          </span>
        )}
        placeholder="Search trails…"
        inputCls={inputCls}
      />
      {!selectedTrail && (
        <p className="text-xs text-zinc-500">Search above or click a trail on the map.</p>
      )}
      <EditTrailForm
        selectedTrail={selectedTrail}
        onSave={onUpdateTrail}
        onDelete={onDeleteTrail}
        onCancel={handleClear}
        disabled={!selectedTrail}
      />
      {selectedTrail && onEnterRefineMode && (
        <button
          type="button"
          onClick={onEnterRefineMode}
          className="w-full py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Refine Line
        </button>
      )}
    </div>
  )
}
