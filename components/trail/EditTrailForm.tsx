'use client'

import { useState, useEffect } from 'react'
import type { Trail, TrimFormState } from '@/lib/types'
import { TrailFormFields } from '@/components/shared/TrailFormFields'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'

export function EditTrailForm({
  selectedTrail,
  onSave,
  onDelete,
  onCancel,
  disabled,
}: {
  selectedTrail: Trail | null
  onSave: (form: TrimFormState) => Promise<string | null>
  onDelete: () => Promise<string | null>
  onCancel: () => void
  disabled: boolean
}) {
  const [form, setForm] = useState<TrimFormState>({
    name: '',
    difficulty: 'not_set',
    direction: 'not_set',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedTrail) return
    setForm({
      name: selectedTrail.name,
      difficulty: selectedTrail.difficulty,
      direction: selectedTrail.direction,
      notes: selectedTrail.notes ?? '',
    })
    setSaveError(null)
  }, [selectedTrail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !selectedTrail || !form.name.trim()) return
    setSaving(true)
    setSaveError(null)
    const err = await onSave(form)
    if (err) setSaveError(err)
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3${disabled ? ' opacity-50' : ''}`}>
      {/* Read-only stats */}
      <div className="flex gap-3 text-xs text-zinc-500">
        {selectedTrail ? (
          <>
            <span>{selectedTrail.distanceKm.toFixed(2)} km</span>
            <span>~{Math.round(selectedTrail.elevationGainFt)} ft gain</span>
          </>
        ) : (
          <span>— km &nbsp; — ft gain</span>
        )}
      </div>

      <TrailFormFields form={form} onChange={setForm} disabled={disabled} />

      {saveError && <p className="text-xs text-red-500">{saveError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || saving || !form.name.trim()}
          className="flex-1 py-2 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>

      <ConfirmDeleteButton onDelete={onDelete} disabled={disabled || saving} entityLabel="Trail" />
    </form>
  )
}
