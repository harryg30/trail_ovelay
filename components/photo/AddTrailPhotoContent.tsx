'use client'

import { useRef, useState } from 'react'
import type { TrailPhoto } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

export function AddTrailPhotoContent(props: {
  user: SessionUser | null
  onCreated: (photo: TrailPhoto) => void
  onCancel: () => void
}) {
  const { user, onCreated, onCancel } = props
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickCamera = () => cameraInputRef.current?.click()
  const pickGallery = () => galleryInputRef.current?.click()

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      let lat: number | undefined
      let lon: number | undefined
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
          // optional GPS
        }
      }

      if (!user) {
        const blobUrl = URL.createObjectURL(file)
        const photo: TrailPhoto = {
          id: `local-${crypto.randomUUID()}`,
          blobUrl,
          takenAt: new Date(),
          accepted: false,
          status: 'published',
          createdAt: new Date(),
          isLocal: true,
          lat,
          lon,
        }
        onCreated(photo)
        return
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
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />

      <p className="text-xs text-muted-foreground">
        {user
          ? 'Take or choose a photo. You can pin it to a trail later from “My trail photos”. GPS is optional.'
          : 'Try the workflow locally: photos are not saved for others until you sign in with Strava.'}
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={pickCamera}
        disabled={uploading}
        className="w-full py-2 px-3 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? 'Working…' : 'Take photo'}
      </button>

      <button
        type="button"
        onClick={pickGallery}
        disabled={uploading}
        className="w-full py-2 px-3 rounded-md border border-emerald-600 text-emerald-700 text-sm font-medium hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Choose from library
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={uploading}
        className="w-full py-2 px-3 rounded-md border border-border text-foreground text-sm hover:bg-mud/45 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
