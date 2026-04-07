'use client'

import { useState, useEffect } from 'react'
import type { Trail, TrimFormState, Network } from '@/lib/types'
import type { TrailEditTool } from '@/lib/modes/types'
import { TrailFormFields } from '@/components/shared/TrailFormFields'
import { ConfirmDeleteButton } from '@/components/shared/ConfirmDeleteButton'
import { polylineDistanceKm } from '@/lib/geo-utils'

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  )
}

function EraserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 20H11" />
      <path d="M5.5 13.5 14 5a2.8 2.8 0 0 1 4 4l-7.5 7.5a2.8 2.8 0 0 1-4 0l-1-1a2.8 2.8 0 0 1 0-4z" />
    </svg>
  )
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h9a7 7 0 1 1 0 14h-1" />
    </svg>
  )
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H11a7 7 0 1 0 0 14h1" />
    </svg>
  )
}

const toolBtnActive = 'bg-zinc-900 text-white border-zinc-900'
const toolBtnIdle = 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
const iconActionBtn =
  'p-2 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

export function TrailEditDrawer({
  variant,
  trailEditTool,
  onSetTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  points,
  selectedTrail,
  refinedPolyline,
  onSaveDraw,
  onSaveEdit,
  onCancel,
  onDeleteTrail,
  networks,
  canPublish,
}: {
  variant: 'draw' | 'edit'
  trailEditTool: TrailEditTool
  onSetTool: (t: TrailEditTool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  points: [number, number][]
  selectedTrail: Trail | null
  refinedPolyline: [number, number][] | null
  onSaveDraw: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
  onSaveEdit: (form: TrimFormState) => Promise<string | null>
  onCancel: () => void
  onDeleteTrail?: () => Promise<string | null>
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
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false)
  const [publishOnSave, setPublishOnSave] = useState(!!canPublish)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (variant !== 'edit' || !selectedTrail) return
    setForm({
      name: selectedTrail.name,
      difficulty: selectedTrail.difficulty,
      direction: selectedTrail.direction,
      notes: selectedTrail.notes ?? '',
    })
    setSaveError(null)
  }, [variant, selectedTrail])

  useEffect(() => {
    if (variant !== 'draw') return
    setForm({ name: '', difficulty: 'not_set', direction: 'not_set', notes: '' })
    setNetworkQuery('')
    setSaveError(null)
  }, [variant])

  const displayPoints = variant === 'edit' ? (refinedPolyline ?? points) : points
  const distanceKm = displayPoints.length >= 2 ? polylineDistanceKm(displayPoints) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !form.name.trim()) return
    if (variant === 'draw' && displayPoints.length < 2) {
      setSaveError('Draw at least 2 points on the map')
      return
    }
    if (variant === 'edit' && displayPoints.length < 2) {
      setSaveError('Trail line needs at least 2 points')
      return
    }
    setSaving(true)
    setSaveError(null)
    const err =
      variant === 'draw'
        ? await onSaveDraw(form, publishOnSave)
        : await onSaveEdit(form)
    if (err) setSaveError(err)
    setSaving(false)
  }

  const title = variant === 'draw' ? 'Draw trail' : 'Edit trail'
  const toolBase = 'p-2 rounded-md border transition-colors flex items-center justify-center'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          <span className="font-medium text-zinc-700">{displayPoints.length}</span> pts
          {distanceKm > 0 && (
            <span className="ml-2">{distanceKm.toFixed(2)} km</span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Tools</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            title="Pencil"
            aria-label="Pencil tool"
            aria-pressed={trailEditTool === 'pencil'}
            onClick={() => onSetTool('pencil')}
            className={`${toolBase} ${trailEditTool === 'pencil' ? toolBtnActive : toolBtnIdle}`}
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Eraser"
            aria-label="Eraser tool"
            aria-pressed={trailEditTool === 'eraser'}
            onClick={() => onSetTool('eraser')}
            className={`${toolBase} ${trailEditTool === 'eraser' ? toolBtnActive : toolBtnIdle}`}
          >
            <EraserIcon className="w-4 h-4" />
          </button>
          <button type="button" className={iconActionBtn} onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo">
            <UndoIcon className="w-4 h-4" />
          </button>
          <button type="button" className={iconActionBtn} onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo">
            <RedoIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="text-xs px-2.5 py-2 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          Pencil: add or drag points on the map; tap midpoints to insert. Eraser: remove a point.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Trail details</p>
        <TrailFormFields form={form} onChange={setForm} disabled={saving} />
      </div>

      {variant === 'draw' && (
        <div className="relative">
          <label className="block text-xs text-zinc-500 mb-1">Network</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Search networks…"
              disabled={saving}
              value={networkQuery}
              onChange={(e) => {
                setNetworkQuery(e.target.value)
                setShowNetworkDropdown(true)
                if (!e.target.value) setForm((f) => ({ ...f, networkId: undefined }))
              }}
              onFocus={() => setShowNetworkDropdown(true)}
              onBlur={() => setTimeout(() => setShowNetworkDropdown(false), 150)}
              className="flex-1 px-2 py-1.5 text-sm border border-zinc-200 rounded-md bg-zinc-50 focus:outline-none focus:border-orange-400 disabled:opacity-50"
            />
            {form.networkId && (
              <button
                type="button"
                onClick={() => {
                  setNetworkQuery('')
                  setForm((f) => ({ ...f, networkId: undefined }))
                }}
                className="text-zinc-400 hover:text-zinc-600 px-1"
                title="Clear network"
              >
                ×
              </button>
            )}
          </div>
          {showNetworkDropdown && networkQuery && (() => {
            const matches = networks.filter((n) => n.name.toLowerCase().includes(networkQuery.toLowerCase()))
            if (!matches.length) return null
            return (
              <ul className="absolute z-50 w-full mt-0.5 bg-white border border-zinc-200 rounded-md shadow-md max-h-36 overflow-y-auto text-sm">
                {matches.map((n) => (
                  <li
                    key={n.id}
                    onMouseDown={() => {
                      setForm((f) => ({ ...f, networkId: n.id }))
                      setNetworkQuery(n.name)
                      setShowNetworkDropdown(false)
                    }}
                    className={`px-3 py-2 cursor-pointer hover:bg-orange-50 ${form.networkId === n.id ? 'font-medium text-orange-700' : ''}`}
                  >
                    {n.name}
                  </li>
                ))}
              </ul>
            )
          })()}
        </div>
      )}

      {variant === 'edit' && selectedTrail && (
        <div className="flex gap-3 text-xs text-zinc-500">
          <span>Original ~{selectedTrail.distanceKm.toFixed(2)} km</span>
          <span>~{Math.round(selectedTrail.elevationGainFt)} ft gain</span>
        </div>
      )}

      {saveError && <p className="text-xs text-red-500">{saveError}</p>}
      {variant === 'edit' && refinedPolyline === null && (
        <p className="text-xs text-zinc-500">Loading line…</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !form.name.trim() || (variant === 'edit' && refinedPolyline === null)}
          className="flex-1 py-2 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : variant === 'draw' ? 'Save trail' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {variant === 'draw' && canPublish && (
        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={publishOnSave}
            onChange={(e) => setPublishOnSave(e.target.checked)}
            className="accent-orange-500"
          />
          Publish to public map
        </label>
      )}

      {variant === 'edit' && onDeleteTrail && selectedTrail && (
        <ConfirmDeleteButton onDelete={onDeleteTrail} disabled={saving} entityLabel="Trail" />
      )}
    </form>
  )
}
