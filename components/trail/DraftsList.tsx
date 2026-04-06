'use client'

import { useState } from 'react'
import type { DraftTrail } from '@/lib/types'

export function DraftsList({
  drafts,
  canPublish,
  onPublish,
  onDelete,
}: {
  drafts: DraftTrail[]
  canPublish: boolean
  onPublish: (localId: string) => Promise<string | null>
  onDelete: (localId: string) => void
}) {
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({})

  const handlePublish = async (localId: string) => {
    setPublishingId(localId)
    setPublishErrors((prev) => { const next = { ...prev }; delete next[localId]; return next })
    const err = await onPublish(localId)
    if (err) setPublishErrors((prev) => ({ ...prev, [localId]: err }))
    setPublishingId(null)
  }

  return (
    <div className="flex flex-col gap-1">
      {drafts.map((draft) => (
        <div key={draft.localId} className="flex flex-col gap-1 py-2 border-b border-zinc-100 last:border-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-800 font-medium truncate">{draft.name}</p>
              <p className="text-xs text-zinc-400">{draft.distanceKm.toFixed(2)} km · {draft.source}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {canPublish && (
                <button
                  onClick={() => handlePublish(draft.localId)}
                  disabled={publishingId === draft.localId}
                  className="px-2 py-1 text-xs rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  title="Publish to public map"
                >
                  {publishingId === draft.localId ? '…' : 'Publish'}
                </button>
              )}
              <button
                onClick={() => onDelete(draft.localId)}
                className="px-2 py-1 text-xs rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
                title="Delete draft"
              >
                ×
              </button>
            </div>
          </div>
          {publishErrors[draft.localId] && (
            <p className="text-xs text-red-500">{publishErrors[draft.localId]}</p>
          )}
        </div>
      ))}
      {!canPublish && (
        <p className="text-xs text-zinc-400 mt-1">
          <a href="/api/auth/strava" className="text-orange-500 hover:underline">Sign in with Strava</a> to publish your drafts.
        </p>
      )}
    </div>
  )
}
