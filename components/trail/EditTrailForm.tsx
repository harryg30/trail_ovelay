'use client'

import { useState, useEffect } from 'react'
import type { Trail, TrimFormState } from '@/lib/types'
import { TrailFormFields } from '@/components/shared/TrailFormFields'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { Button } from '@/components/ui/button'

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
    /* eslint-disable react-hooks/set-state-in-effect -- sync local form when trail selection changes */
    setForm({
      name: selectedTrail.name,
      difficulty: selectedTrail.difficulty,
      direction: selectedTrail.direction,
      notes: selectedTrail.notes ?? '',
    })
    setSaveError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
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
      <div className="flex gap-3 font-mono text-xs text-muted-foreground">
        {selectedTrail ? (
          <>
            <span>{selectedTrail.distanceKm.toFixed(2)} km</span>
            <span>~{Math.round(selectedTrail.elevationGainFt)} ft gain</span>
          </>
        ) : (
          <span>— km &nbsp; — ft gain</span>
        )}
      </div>

      {selectedTrail?.osmWayId && (
        <div className="rounded-md border border-forest/30 bg-forest/5 px-2.5 py-1.5 text-xs text-forest">
          Linked to{' '}
          <a
            href={`https://www.openstreetmap.org/way/${selectedTrail.osmWayId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            OSM way {selectedTrail.osmWayId}
          </a>
        </div>
      )}

      <TrailFormFields form={form} onChange={setForm} disabled={disabled} />

      {saveError && <p className="text-xs font-semibold text-destructive">{saveError}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="catalog"
          className="flex-1"
          disabled={disabled || saving || !form.name.trim()}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outlineThick" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      </div>

      <ConfirmDeleteButton onDelete={onDelete} disabled={disabled || saving} entityLabel="Trail" />
    </form>
  )
}
