'use client'

import { useState } from 'react'
import type { DraftTrail } from '@/lib/types'
import { Button } from '@/components/ui/button'

export function DraftsList({
  drafts,
  canPublish,
  onPublish,
  onDelete,
  onEdit,
}: {
  drafts: DraftTrail[]
  canPublish: boolean
  onPublish: (localId: string) => Promise<string | null>
  onDelete: (localId: string) => void
  onEdit: (localId: string) => void
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
        <div key={draft.localId} className="flex flex-col gap-1 py-2 border-b border-border/80 last:border-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium truncate">{draft.name}</p>
              <p className="text-xs text-muted-foreground">{draft.distanceKm.toFixed(2)} km · {draft.source}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                type="button"
                variant="outlineThick"
                size="xs"
                onClick={() => onEdit(draft.localId)}
                title="Open in add-trail tools"
              >
                Edit
              </Button>
              {canPublish && (
                <Button
                  type="button"
                  variant="catalog"
                  size="xs"
                  onClick={() => handlePublish(draft.localId)}
                  disabled={publishingId === draft.localId}
                  title="Publish to public map"
                >
                  {publishingId === draft.localId ? '…' : 'Publish'}
                </Button>
              )}
              <Button
                type="button"
                variant="outlineThick"
                size="xs"
                onClick={() => onDelete(draft.localId)}
                title="Delete draft"
              >
                ×
              </Button>
            </div>
          </div>
          {publishErrors[draft.localId] && (
            <p className="text-xs text-destructive">{publishErrors[draft.localId]}</p>
          )}
        </div>
      ))}
      {!canPublish && (
        <p className="text-xs text-muted-foreground mt-1">
          <a href="/api/auth/strava" className="font-bold text-electric underline-offset-2 hover:underline">
            Sign in with Strava
          </a>{' '}
          to publish your drafts.
        </p>
      )}
    </div>
  )
}
