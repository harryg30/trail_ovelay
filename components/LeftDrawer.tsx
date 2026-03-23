'use client'

import { useRef, useState, useEffect } from 'react'
import type { Ride, Trail, TrimPoint, TrimSegment, TrimFormState, EditMode } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import AuthButton from '@/components/AuthButton'

interface LeftDrawerProps {
  user: SessionUser | null
  rides: Ride[]
  onRidesUploaded: (rides: Ride[]) => void
  editMode: EditMode
  onEditModeChange: (mode: EditMode) => void
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onSaveTrail: (form: TrimFormState) => Promise<string | null>
  onStepTrimPoint: (which: 'start' | 'end', delta: number) => void
  onClearTrimPoint: (which: 'start' | 'end') => void
  selectedTrail: Trail | null
  onSelectTrail: (trail: Trail | null) => void
  onUpdateTrail: (form: TrimFormState) => Promise<string | null>
}

export default function LeftDrawer({
  user,
  rides,
  onRidesUploaded,
  editMode,
  onEditModeChange,
  trimStart,
  trimSegment,
  onSaveTrail,
  onStepTrimPoint,
  onClearTrimPoint,
  selectedTrail,
  onSelectTrail,
  onUpdateTrail,
}: LeftDrawerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!data.success) {
        setUploadError(data.error ?? 'Upload failed')
      } else {
        onRidesUploaded(data.rides)
      }
    } catch {
      setUploadError('Network error — upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleModeClick = (mode: EditMode) => {
    onEditModeChange(editMode === mode ? null : mode)
  }

  const activeCls =
    'flex-1 py-1.5 rounded-md bg-orange-500 text-white text-xs font-medium transition-colors'
  const inactiveCls =
    'flex-1 py-1.5 rounded-md border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition-colors'
  const disabledCls =
    'flex-1 py-1.5 rounded-md border border-zinc-200 text-zinc-300 text-xs font-medium cursor-not-allowed opacity-50'

  return (
    <div className="w-80 h-screen bg-white border-r border-zinc-200 shadow-lg flex flex-col overflow-y-auto shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-100">
        <h1 className="text-base font-semibold text-zinc-900">Trail Overlay</h1>
        <AuthButton user={user} />
      </div>

      {/* Upload section */}
      <div className="px-4 py-4 border-b border-zinc-100 flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,.zip"
          className="hidden"
          onChange={handleFileChange}
        />
        {user ? (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2 px-3 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload GPX / ZIP'}
          </button>
        ) : (
          <p className="text-xs text-zinc-400">Connect with Strava to upload rides.</p>
        )}
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      </div>

      {/* Rides list */}
      <div className="px-4 py-4 border-b border-zinc-100 flex flex-col gap-2">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Rides ({rides.length})
        </h2>
        {rides.length === 0 ? (
          <p className="text-xs text-zinc-400">No rides uploaded yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rides.map((ride) => (
              <li
                key={ride.id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-zinc-50 text-sm"
              >
                <span className="text-zinc-800 truncate pr-2">{ride.name}</span>
                <span className="text-zinc-400 shrink-0 text-xs">
                  {(ride.distance / 1000).toFixed(1)} km
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit section */}
      <div className="px-4 py-4 flex flex-col gap-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Edit</h2>

        {/* Mode buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => user && handleModeClick('add-trail')}
            disabled={!user}
            className={!user ? disabledCls : editMode === 'add-trail' ? activeCls : inactiveCls}
            title={!user ? 'Connect with Strava to save trails' : undefined}
          >
            Add New Trail
          </button>
          <button
            onClick={() => user && handleModeClick('edit-trail')}
            disabled={!user}
            className={!user ? disabledCls : editMode === 'edit-trail' ? activeCls : inactiveCls}
            title={!user ? 'Connect with Strava to edit trails' : undefined}
          >
            Edit Trail
          </button>
          <button disabled className={disabledCls} title="Coming soon">
            Trail Networks
          </button>
        </div>

        {/* Per-mode content */}
        {editMode === 'add-trail' && (
          <AddTrailContent
            trimStart={trimStart}
            trimSegment={trimSegment}
            onSaveTrail={onSaveTrail}
            onCancel={() => onEditModeChange(null)}
            onStepTrimPoint={onStepTrimPoint}
            onClearTrimPoint={onClearTrimPoint}
          />
        )}
        {editMode === 'edit-trail' && (
          <EditTrailContent
            selectedTrail={selectedTrail}
            onSelectTrail={onSelectTrail}
            onUpdateTrail={onUpdateTrail}
          />
        )}
      </div>
    </div>
  )
}

function AddTrailContent({
  trimStart,
  trimSegment,
  onSaveTrail,
  onCancel,
  onStepTrimPoint,
  onClearTrimPoint,
}: {
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onSaveTrail: (form: TrimFormState) => Promise<string | null>
  onCancel: () => void
  onStepTrimPoint: (which: 'start' | 'end', delta: number) => void
  onClearTrimPoint: (which: 'start' | 'end') => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {!trimStart && (
        <p className="text-xs text-zinc-500">Click a ride on the map to set the start point.</p>
      )}
      {trimStart && !trimSegment && (
        <p className="text-xs text-orange-600 font-medium">
          Start set — click to set the end point.
        </p>
      )}
      {trimSegment && (
        <EndpointControls onStep={onStepTrimPoint} onClear={onClearTrimPoint} />
      )}
      <TrimForm
        trimSegment={trimSegment}
        onSave={onSaveTrail}
        onCancel={onCancel}
        disabled={!trimSegment}
      />
    </div>
  )
}

function EndpointControls({
  onStep,
  onClear,
}: {
  onStep: (which: 'start' | 'end', delta: number) => void
  onClear: (which: 'start' | 'end') => void
}) {
  const stepBtn =
    'w-7 h-7 flex items-center justify-center rounded border border-zinc-200 text-zinc-600 text-xs hover:bg-zinc-50 active:bg-zinc-100 transition-colors'
  const clearBtn =
    'ml-auto px-2 h-7 flex items-center rounded border border-zinc-200 text-zinc-400 text-xs hover:border-red-300 hover:text-red-500 transition-colors'

  const row = (label: string, which: 'start' | 'end') => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 w-8 shrink-0">{label}</span>
      <button type="button" className={stepBtn} onClick={() => onStep(which, -1)} title="Step back">
        ←
      </button>
      <button type="button" className={stepBtn} onClick={() => onStep(which, 1)} title="Step forward">
        →
      </button>
      <button type="button" className={clearBtn} onClick={() => onClear(which)}>
        Clear
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-1.5 py-2 px-2.5 rounded-md bg-zinc-50 border border-zinc-100">
      {row('Start', 'start')}
      {row('End', 'end')}
    </div>
  )
}

function TrimForm({
  trimSegment,
  onSave,
  onCancel,
  disabled,
}: {
  trimSegment: TrimSegment | null
  onSave: (form: TrimFormState) => Promise<string | null>
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

  // Reset form name when segment is set or changes
  useEffect(() => {
    if (!trimSegment) return
    setForm((prev) => ({ ...prev, name: trimSegment.ride.name + ' Trail' }))
    setSaveError(null)
  }, [trimSegment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !trimSegment || !form.name.trim()) return
    setSaving(true)
    setSaveError(null)
    const err = await onSave(form)
    if (err) setSaveError(err)
    setSaving(false)
  }

  const field = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  )

  const inputCls =
    'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-orange-400 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3${disabled ? ' opacity-50' : ''}`}>
      {/* Read-only stats */}
      <div className="flex gap-3 text-xs text-zinc-500">
        {trimSegment ? (
          <>
            <span>{trimSegment.distanceKm.toFixed(2)} km</span>
            <span>~{Math.round(trimSegment.elevationGainFt)} ft gain</span>
          </>
        ) : (
          <span>— km &nbsp; — ft gain</span>
        )}
      </div>

      {field(
        'Name *',
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className={inputCls}
          disabled={disabled}
          required
        />
      )}

      {field(
        'Difficulty',
        <select
          value={form.difficulty}
          onChange={(e) =>
            setForm((p) => ({ ...p, difficulty: e.target.value as TrimFormState['difficulty'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="easy">Easy</option>
          <option value="intermediate">Intermediate</option>
          <option value="hard">Hard</option>
        </select>
      )}

      {field(
        'Direction',
        <select
          value={form.direction}
          onChange={(e) =>
            setForm((p) => ({ ...p, direction: e.target.value as TrimFormState['direction'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="one-way">One-way</option>
          <option value="out-and-back">Out and back</option>
          <option value="loop">Loop</option>
        </select>
      )}

      {field(
        'Notes',
        <textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Optional"
          disabled={disabled}
        />
      )}

      {saveError && <p className="text-xs text-red-500">{saveError}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled || saving || !form.name.trim()}
          className="flex-1 py-2 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Trail'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-md border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function EditTrailContent({
  selectedTrail,
  onSelectTrail,
  onUpdateTrail,
}: {
  selectedTrail: Trail | null
  onSelectTrail: (trail: Trail | null) => void
  onUpdateTrail: (form: TrimFormState) => Promise<string | null>
}) {
  return (
    <div className="flex flex-col gap-3">
      {!selectedTrail && (
        <p className="text-xs text-zinc-500">Click a trail on the map to select it.</p>
      )}
      <EditTrailForm
        selectedTrail={selectedTrail}
        onSave={onUpdateTrail}
        onCancel={() => onSelectTrail(null)}
        disabled={!selectedTrail}
      />
    </div>
  )
}

function EditTrailForm({
  selectedTrail,
  onSave,
  onCancel,
  disabled,
}: {
  selectedTrail: Trail | null
  onSave: (form: TrimFormState) => Promise<string | null>
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

  const field = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  )

  const inputCls =
    'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-orange-400 disabled:opacity-50 disabled:cursor-not-allowed'

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

      {field(
        'Name *',
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className={inputCls}
          disabled={disabled}
          required
        />
      )}

      {field(
        'Difficulty',
        <select
          value={form.difficulty}
          onChange={(e) =>
            setForm((p) => ({ ...p, difficulty: e.target.value as TrimFormState['difficulty'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="easy">Easy</option>
          <option value="intermediate">Intermediate</option>
          <option value="hard">Hard</option>
        </select>
      )}

      {field(
        'Direction',
        <select
          value={form.direction}
          onChange={(e) =>
            setForm((p) => ({ ...p, direction: e.target.value as TrimFormState['direction'] }))
          }
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="one-way">One-way</option>
          <option value="out-and-back">Out and back</option>
          <option value="loop">Loop</option>
        </select>
      )}

      {field(
        'Notes',
        <textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Optional"
          disabled={disabled}
        />
      )}

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
    </form>
  )
}
