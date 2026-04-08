'use client'

import { useRef, useState } from 'react'
import type { TrailPhoto } from '@/lib/types'

export function AddTrailPhotoContent(props: {
  onCreated: (photo: TrailPhoto) => void
  onCancel: () => void
}) {
  const { onCreated, onCancel } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const takePhoto = () => inputRef.current?.click()

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      let lat: number | null = null
      let lon: number | null = null
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 15_000,
            })
          })
          lat = pos.coords.latitude
          lon = pos.coords.longitude
        } catch {
          // user denied or unavailable; fall back to manual placement
        }
      }

      const fd = new FormData()
      fd.append('file', file)
      if (lat != null) fd.append('lat', String(lat))
      if (lon != null) fd.append('lon', String(lon))
      fd.append('takenAt', new Date().toISOString())

      const res = await fetch('/api/trail-photos', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Upload failed')
        return
      }
      onCreated(data.photo as TrailPhoto)
    } catch {
      setError('Network error — upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />

      <p className="text-xs text-zinc-500">
        Take a photo, then place it on the map (we’ll try to use your GPS if available).
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={takePhoto}
        disabled={uploading}
        className="w-full py-2 px-3 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Uploading…' : 'Take photo'}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={uploading}
        className="w-full py-2 px-3 rounded-md border border-zinc-200 text-zinc-700 text-sm hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}

