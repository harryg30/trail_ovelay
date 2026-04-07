'use client'

import { useState, useEffect, useRef } from 'react'
import type { TrimSegment, TrimFormState, Network } from '@/lib/types'
import { TrailFormFields } from '@/components/shared/TrailFormFields'

const AUTOSAVE_KEY = 'trim_form_autosave'

export function TrimForm({
  trimSegment,
  onSave,
  onCancel,
  disabled,
  networks,
  canPublish,
  defaultName,
}: {
  trimSegment: TrimSegment | null
  onSave: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
  onCancel: () => void
  disabled: boolean
  networks: Network[]
  canPublish?: boolean
  defaultName?: string
}) {
  const [form, setForm] = useState<TrimFormState>({
    name: '',
    difficulty: 'not_set',
    direction: 'not_set',
    notes: '',
  })
  const [networkQuery, setNetworkQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const networkInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [publishOnSave, setPublishOnSave] = useState(!!canPublish)
  const formRef = useRef(form)
  formRef.current = form

  // Restore form from autosave (survives Strava OAuth redirect)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      if (saved) {
        setForm(JSON.parse(saved) as TrimFormState)
        localStorage.removeItem(AUTOSAVE_KEY)
      }
    } catch { /* ignore */ }
  }, [])

  // Persist form to localStorage on page navigation (beforeunload unreliable on mobile)
  useEffect(() => {
    const handler = () => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(formRef.current))
      } catch { /* ignore quota / private mode */ }
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [])

  // Auto-set name when segment changes, but don't overwrite if user has already entered one
  useEffect(() => {
    if (defaultName) {
      setForm((prev) => (prev.name ? prev : { ...prev, name: defaultName }))
      setSaveError(null)
      return
    }
    if (!trimSegment) return
    setForm((prev) => {
      if (prev.name) return prev
      return { ...prev, name: trimSegment.ride.name + ' Trail' }
    })
    setSaveError(null)
  }, [trimSegment, defaultName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !trimSegment || !form.name.trim()) return
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

      <TrailFormFields form={form} onChange={setForm} disabled={disabled} />

      {/* Network search */}
      <div className="relative">
        <label className="block text-xs text-zinc-500 mb-1">Network</label>
        <div className="flex items-center gap-1">
          <input
            ref={networkInputRef}
            type="text"
            placeholder="Search networks…"
            disabled={disabled}
            value={networkQuery}
            onChange={(e) => {
              setNetworkQuery(e.target.value)
              setShowDropdown(true)
              if (!e.target.value) setForm((f) => ({ ...f, networkId: undefined }))
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className="flex-1 px-2 py-1 text-xs border border-zinc-200 rounded focus:outline-none focus:border-zinc-400 disabled:opacity-50"
          />
          {form.networkId && (
            <button
              type="button"
              onClick={() => { setNetworkQuery(''); setForm((f) => ({ ...f, networkId: undefined })) }}
              className="text-zinc-400 hover:text-zinc-600 px-1"
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
            <ul className="absolute z-50 w-full mt-0.5 bg-white border border-zinc-200 rounded shadow-md max-h-36 overflow-y-auto text-xs">
              {matches.map((n) => (
                <li
                  key={n.id}
                  onMouseDown={() => {
                    setForm((f) => ({ ...f, networkId: n.id }))
                    setNetworkQuery(n.name)
                    setShowDropdown(false)
                  }}
                  className={`px-2 py-1.5 cursor-pointer hover:bg-zinc-50 ${form.networkId === n.id ? 'font-medium text-orange-600' : ''}`}
                >
                  {n.name}
                </li>
              ))}
            </ul>
          )
        })()}
      </div>

      {saveError && <p className="text-xs text-red-500">{saveError}</p>}

      <div className="flex items-center gap-2">
        <div className="flex gap-2 flex-1">
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
      </div>
      {canPublish && (
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
    </form>
  )
}
