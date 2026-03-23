'use client'

import { useRef, useState } from 'react'
import type { Ride } from '@/lib/types'

interface LeftDrawerProps {
  rides: Ride[]
  onRidesUploaded: (rides: Ride[]) => void
}

export default function LeftDrawer({ rides, onRidesUploaded }: LeftDrawerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? 'Upload failed')
      } else {
        onRidesUploaded(data.rides)
      }
    } catch {
      setError('Network error — upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="w-80 h-screen bg-white border-r border-zinc-200 shadow-lg flex flex-col overflow-y-auto shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-100">
        <h1 className="text-base font-semibold text-zinc-900">Trail Overlay</h1>
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
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full py-2 px-3 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload GPX / ZIP'}
        </button>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Rides list */}
      <div className="px-4 py-4 flex flex-col gap-2">
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
    </div>
  )
}
