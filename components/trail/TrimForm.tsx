'use client'

import { useState, useEffect, useRef } from 'react'
import type { TrimSegment, TrimFormState, Network } from '@/lib/types'
import { TrailFormFields } from '@/components/shared/TrailFormFields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [publishOnSave, setPublishOnSave] = useState(!!canPublish)
  const formRef = useRef(form)

  useEffect(() => {
    formRef.current = form
  }, [form])

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

  useEffect(() => {
    const handler = () => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(formRef.current))
      } catch { /* ignore quota / private mode */ }
    }
    window.addEventListener('pagehide', handler)
    return () => window.removeEventListener('pagehide', handler)
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync suggested name from segment / defaultName */
    if (defaultName) {
      setForm((prev) => (prev.name ? prev : { ...prev, name: defaultName }))
      setSaveError(null)
    } else if (trimSegment) {
      setForm((prev) => {
        if (prev.name) return prev
        return { ...prev, name: trimSegment.ride.name + ' Trail' }
      })
      setSaveError(null)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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
      <div className="flex gap-3 font-mono text-xs text-muted-foreground">
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

      <div className="relative">
        <Label className="mb-1 text-[11px]">Network</Label>
        <div className="flex items-center gap-1">
          <Input
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
            className="h-8 flex-1 text-xs"
          />
          {form.networkId && (
            <button
              type="button"
              onClick={() => { setNetworkQuery(''); setForm((f) => ({ ...f, networkId: undefined })) }}
              className="px-1 text-muted-foreground hover:text-foreground"
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
                    'cursor-pointer px-2 py-1.5 hover:bg-mud/80',
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

      {saveError && <p className="text-xs font-semibold text-destructive">{saveError}</p>}

      <div className="flex flex-1 items-center gap-2">
        <div className="flex flex-1 gap-2">
          <Button
            type="submit"
            variant="catalog"
            className="flex-1"
            disabled={disabled || saving || !form.name.trim()}
          >
            {saving ? 'Saving...' : 'Save Trail'}
          </Button>
          <Button type="button" variant="outlineThick" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
      {canPublish && (
        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={publishOnSave}
            onChange={(e) => setPublishOnSave(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Publish to public map
        </label>
      )}
    </form>
  )
}
