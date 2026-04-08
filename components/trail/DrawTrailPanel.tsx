'use client'

import { useState, useEffect, useRef } from 'react'
import type { TrimFormState, Network } from '@/lib/types'
import { TrailFormFields } from '@/components/shared/TrailFormFields'
import { Button } from '@/components/ui/button'
import { polylineDistanceKm } from '@/lib/geo-utils'
import { cn } from '@/lib/utils'

const AUTOSAVE_KEY = 'draw_form_autosave'

export function DrawTrailPanel({
  drawPoints,
  finished,
  onFinish,
  onUndo,
  onSave,
  onCancel,
  networks,
  canPublish,
}: {
  drawPoints: [number, number][]
  finished: boolean
  onFinish: () => void
  onUndo: () => void
  onSave: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
  onCancel: () => void
  networks: Network[]
  canPublish?: boolean
}) {
  const [form, setForm] = useState<TrimFormState>({
    name: '',
    difficulty: 'not_set',
    direction: 'not_set',
    notes: '',
  })
  const [networkQuery, setNetworkQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [publishOnSave, setPublishOnSave] = useState(!!canPublish)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const formRef = useRef(form)

  useEffect(() => {
    formRef.current = form
  }, [form])

  // Restore form from autosave (survives Strava OAuth redirect)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      if (saved) {
        /* eslint-disable react-hooks/set-state-in-effect -- restore after OAuth redirect */
        setForm(JSON.parse(saved) as TrimFormState)
        /* eslint-enable react-hooks/set-state-in-effect */
        localStorage.removeItem(AUTOSAVE_KEY)
      }
    } catch { /* ignore */ }
  }, [])

  // Persist form to localStorage on page navigation
  useEffect(() => {
    const handler = () => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(formRef.current))
      } catch { /* ignore quota / private mode */ }
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [])

  const distanceKm = drawPoints.length >= 2 ? polylineDistanceKm(drawPoints) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !form.name.trim() || drawPoints.length < 2) return
    setSaving(true)
    setSaveError(null)
    const err = await onSave(form, publishOnSave)
    if (err) {
      setSaveError(err)
    } else {
      localStorage.removeItem(AUTOSAVE_KEY)
    }
    setSaving(false)
  }

  if (!finished) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Click on the map to plot trail points.
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{drawPoints.length} point{drawPoints.length !== 1 ? 's' : ''} placed</span>
          {distanceKm > 0 && <span>{distanceKm.toFixed(2)} km</span>}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="catalog"
            className="flex-1"
            disabled={drawPoints.length < 2}
            onClick={onFinish}
          >
            Finish Drawing
          </Button>
          <Button
            type="button"
            variant="outlineThick"
            disabled={drawPoints.length === 0}
            onClick={onUndo}
            title="Undo last point"
          >
            ↩
          </Button>
          <Button type="button" variant="outlineThick" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>{distanceKm.toFixed(2)} km</span>
        <span>{drawPoints.length} points</span>
      </div>

      <TrailFormFields form={form} onChange={setForm} disabled={saving} />

      {/* Network search */}
      <div className="relative">
        <label className="block text-xs text-muted-foreground mb-1">Network</label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Search networks…"
            disabled={saving}
            value={networkQuery}
            onChange={(e) => {
              setNetworkQuery(e.target.value)
              setShowDropdown(true)
              if (!e.target.value) setForm((f) => ({ ...f, networkId: undefined }))
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="h-8 flex-1 rounded-md border-2 border-foreground bg-card px-2 py-1 text-xs shadow-[inset_2px_2px_0_0_var(--mud)] focus:outline-none focus:ring-2 focus:ring-ring/45 disabled:opacity-50"
          />
          {form.networkId && (
            <button
              type="button"
              onClick={() => { setNetworkQuery(''); setForm((f) => ({ ...f, networkId: undefined })) }}
              className="text-muted-foreground hover:text-muted-foreground px-1"
              title="Clear network"
            >
              ×
            </button>
          )}
        </div>
        {showDropdown && networkQuery && (() => {
          const matches = networks.filter((n) =>
            n.name.toLowerCase().includes(networkQuery.toLowerCase())
          )
          if (!matches.length) return null
          return (
            <ul className="absolute z-50 mt-0.5 max-h-36 w-full overflow-y-auto border-2 border-foreground bg-card text-xs shadow-[3px_3px_0_0_var(--foreground)]">
              {matches.map((n) => (
                <li
                  key={n.id}
                  onMouseDown={() => {
                    setForm((f) => ({ ...f, networkId: n.id }))
                    setNetworkQuery(n.name)
                    setShowDropdown(false)
                  }}
                  className={cn(
                    'cursor-pointer px-2 py-1.5 hover:bg-mud/45',
                    form.networkId === n.id && 'bg-primary/20 font-bold text-primary'
                  )}
                >
                  {n.name}
                </li>
              ))}
            </ul>
          )
        })()}
      </div>

      {saveError && <p className="text-xs text-destructive">{saveError}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="catalog"
          className="flex-1"
          disabled={saving || !form.name.trim()}
        >
          {saving ? 'Saving...' : 'Save Trail'}
        </Button>
        <Button type="button" variant="outlineThick" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {canPublish && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={publishOnSave}
            onChange={(e) => setPublishOnSave(e.target.checked)}
            className="accent-primary size-3.5"
          />
          Publish to public map
        </label>
      )}
    </form>
  )
}
