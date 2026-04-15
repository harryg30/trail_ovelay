'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { Trail, Network, TrailRevision, TrailRevisionComment, TrailPhoto, TrailActivityItem } from '@/lib/types'
import { DIFFICULTY_LABELS, DIFFICULTY_BADGE_VARIANT, DIRECTION_LABELS } from '@/lib/trail-constants'
import type { SessionUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faPenToSquare,
  faRotateLeft,
  faChevronDown,
  faChevronRight,
  faChevronLeft,
  faSpinner,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

const ChangeDetailModal = dynamic(
  () => import('@/components/trail/ChangeDetailModal').then(m => ({ default: m.ChangeDetailModal })),
  { ssr: false }
)

interface TrailDetailPanelProps {
  trail: Trail
  networks: Network[]
  user: SessionUser | null
  onClose: () => void
  onEdit: (trail: Trail) => void
  onPhotoOpen?: (photoId: string) => void
  onPhotoClose?: () => void
  initialPhotoId?: string
}

type Section = 'summary' | 'gallery' | 'comments' | 'versions'

function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  create:   { label: 'Created',     cls: 'bg-forest/20 text-forest border-forest/30' },
  update:   { label: 'Updated',     cls: 'bg-electric/15 text-electric border-electric/30' },
  delete:   { label: 'Deleted',     cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  rollback: { label: 'Rolled back', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30' },
}

export function TrailDetailPanel({ trail, networks, user, onClose, onEdit, onPhotoOpen, onPhotoClose, initialPhotoId }: TrailDetailPanelProps) {
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(['summary', 'gallery', 'comments', 'versions']))
  const [copied, setCopied] = useState(false)
  const initialPhotoRestoredRef = useRef(false)

  const [photos, setPhotos] = useState<TrailPhoto[] | null>(null)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const [comments, setComments] = useState<TrailRevisionComment[] | null>(null)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const [revisions, setRevisions] = useState<TrailRevision[] | null>(null)
  const [revisionsLoading, setRevisionsLoading] = useState(false)
  const [diffRevision, setDiffRevision] = useState<TrailActivityItem | null>(null)
  const [rollbackId, setRollbackId] = useState<string | null>(null)
  const [rollbackError, setRollbackError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Reset when trail changes
  useEffect(() => {
    setPhotos(null)
    setComments(null)
    setRevisions(null)
    setOpenSections(new Set(['summary', 'gallery', 'comments', 'versions']))
    setCommentBody('')
    setCommentError(null)
    setRollbackError(null)
    setLightboxIndex(null)
    setDiffRevision(null)
    initialPhotoRestoredRef.current = false
    loadPhotos()
    loadComments()
    loadRevisions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail.id])

  const trailNetworks = networks.filter(n => n.trailIds.includes(trail.id))

  function toggleSection(s: Section) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(s)) {
        next.delete(s)
      } else {
        next.add(s)
        // Lazy-load data on first open
        if (s === 'gallery' && photos === null && !photosLoading) loadPhotos()
        if (s === 'comments' && comments === null && !commentsLoading) loadComments()
        if (s === 'versions' && revisions === null && !revisionsLoading) loadRevisions()
      }
      return next
    })
  }

  async function loadPhotos() {
    setPhotosLoading(true)
    try {
      const res = await fetch(`/api/trail-photos?trailId=${trail.id}&limit=50`)
      const data = await res.json()
      if (mountedRef.current) {
        const loaded = data.photos ?? []
        setPhotos(loaded)
        if (initialPhotoId && !initialPhotoRestoredRef.current) {
          initialPhotoRestoredRef.current = true
          const idx = loaded.findIndex((p: TrailPhoto) => p.id === initialPhotoId)
          if (idx >= 0) {
            setLightboxIndex(idx)
            onPhotoOpen?.(loaded[idx].id)
          }
        }
      }
    } catch {
      if (mountedRef.current) setPhotos([])
    } finally {
      if (mountedRef.current) setPhotosLoading(false)
    }
  }

  async function loadComments() {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/trails/${trail.id}/comments`)
      const data = await res.json()
      if (mountedRef.current) setComments(data.comments ?? [])
    } catch {
      if (mountedRef.current) setComments([])
    } finally {
      if (mountedRef.current) setCommentsLoading(false)
    }
  }

  async function loadRevisions() {
    setRevisionsLoading(true)
    try {
      const res = await fetch(`/api/trails/${trail.id}/revisions?limit=20`)
      const data = await res.json()
      if (mountedRef.current) setRevisions(data.revisions ?? [])
    } catch {
      if (mountedRef.current) setRevisions([])
    } finally {
      if (mountedRef.current) setRevisionsLoading(false)
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    setCommentSubmitting(true)
    setCommentError(null)
    try {
      const res = await fetch(`/api/trails/${trail.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody.trim() }),
      })
      const data = await res.json()
      if (data.success && data.comment) {
        setComments(prev => [...(prev ?? []), data.comment])
        setCommentBody('')
      } else {
        setCommentError(data.error ?? 'Failed to post comment')
      }
    } catch {
      setCommentError('Network error')
    } finally {
      setCommentSubmitting(false)
    }
  }

  async function handleRollback(revisionId: string) {
    if (!confirm('Roll back to this version? The current trail data will be replaced.')) return
    setRollbackId(revisionId)
    setRollbackError(null)
    try {
      const res = await fetch(`/api/trails/${trail.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId }),
      })
      const data = await res.json()
      if (!data.success) {
        setRollbackError(data.error ?? 'Rollback failed')
      } else {
        // Reload revisions to show the new rollback entry
        setRevisions(null)
        loadRevisions()
      }
    } catch {
      setRollbackError('Network error')
    } finally {
      setRollbackId(null)
    }
  }

  const difficultyLabel = DIFFICULTY_LABELS[trail.difficulty] ?? null
  const difficultyVariant = DIFFICULTY_BADGE_VARIANT[trail.difficulty] ?? null
  const directionLabel = DIRECTION_LABELS[trail.direction] ?? null

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b-2 border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Back"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5" />
          Back
        </button>
        <h2 className="flex-1 min-w-0 font-display text-sm font-normal uppercase tracking-wide text-foreground truncate">
          {trail.name}
        </h2>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          title="Copy share link"
        >
          {copied ? 'Copied!' : 'Share'}
        </button>
        {user && (
          <button
            type="button"
            onClick={() => onEdit(trail)}
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Edit trail"
          >
            <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Summary section */}
      <SectionHeader
        label="Summary"
        open={openSections.has('summary')}
        onToggle={() => toggleSection('summary')}
      />
      {openSections.has('summary') && (
        <div className="px-4 py-3 flex flex-col gap-3 border-b-2 border-border">
          <div className="flex flex-wrap gap-1.5">
            {difficultyLabel && difficultyVariant && (
              <Badge variant={difficultyVariant as never}>{difficultyLabel}</Badge>
            )}
            {directionLabel && (
              <Badge variant="secondary">{directionLabel}</Badge>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <Stat label="Distance" value={`${trail.distanceKm.toFixed(1)} km`} />
            {trail.elevationGainFt > 0 && (
              <Stat label="Elevation gain" value={`${Math.round(trail.elevationGainFt)} ft`} />
            )}
          </div>
          {trail.notes && (
            <p className="text-sm text-foreground whitespace-pre-wrap">{trail.notes}</p>
          )}
          {trailNetworks.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {trailNetworks.map(n => (
                <span
                  key={n.id}
                  className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {n.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gallery section */}
      <SectionHeader
        label={`Gallery${photos && photos.length > 0 ? ` (${photos.length})` : ''}`}
        open={openSections.has('gallery')}
        onToggle={() => toggleSection('gallery')}
      />
      {openSections.has('gallery') && (
        <div className="px-4 py-3 border-b-2 border-border">
          {photosLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FontAwesomeIcon icon={faSpinner} spin className="w-3.5 h-3.5" />
              Loading photos…
            </div>
          ) : !photos || photos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((photo, i) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => { setLightboxIndex(i); onPhotoOpen?.(photo.id) }}
                  className="relative aspect-square overflow-hidden rounded-md border-2 border-border hover:border-foreground/40 transition-colors"
                >
                  <img
                    src={photo.thumbnailUrl ?? photo.blobUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comments section */}
      <SectionHeader
        label={`Comments${comments && comments.length > 0 ? ` (${comments.length})` : ''}`}
        open={openSections.has('comments')}
        onToggle={() => toggleSection('comments')}
      />
      {openSections.has('comments') && (
        <div className="px-4 py-3 flex flex-col gap-3 border-b-2 border-border">
          {commentsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FontAwesomeIcon icon={faSpinner} spin className="w-3.5 h-3.5" />
              Loading comments…
            </div>
          ) : (
            <>
              {(!comments || comments.length === 0) ? (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {comments.map(c => (
                    <li key={c.id} className="flex gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-mud/60 text-[10px] font-bold uppercase text-foreground">
                        {(c.authorName ?? '?')[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-semibold text-foreground">{c.authorName ?? 'Unknown'}</span>
                          <span className="text-[10px] text-muted-foreground">{formatRelativeTime(new Date(c.createdAt))}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-foreground whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {user ? (
                <form onSubmit={submitComment} className="flex flex-col gap-2">
                  <textarea
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    placeholder="Add a comment…"
                    rows={2}
                    className="w-full resize-none rounded-sm border-2 border-foreground bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {commentError && <p className="text-xs text-destructive">{commentError}</p>}
                  <Button
                    type="submit"
                    variant="default"
                    size="sm"
                    disabled={commentSubmitting || !commentBody.trim()}
                    className="self-end"
                  >
                    {commentSubmitting ? 'Posting…' : 'Post'}
                  </Button>
                </form>
              ) : (
                <p className="text-xs text-muted-foreground">Log in to leave a comment.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Versions section */}
      <SectionHeader
        label={`Versions${revisions && revisions.length > 0 ? ` (${revisions.length})` : ''}`}
        open={openSections.has('versions')}
        onToggle={() => toggleSection('versions')}
      />
      {openSections.has('versions') && (
        <div className="px-4 py-3 flex flex-col gap-2 border-b-2 border-border">
          {revisionsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FontAwesomeIcon icon={faSpinner} spin className="w-3.5 h-3.5" />
              Loading history…
            </div>
          ) : !revisions || revisions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No version history yet.</p>
          ) : (
            <>
              {rollbackError && <p className="text-xs text-destructive">{rollbackError}</p>}
              <ul className="flex flex-col gap-2">
                {revisions.map((rev, i) => {
                  const meta = ACTION_LABELS[rev.action] ?? { label: rev.action, cls: 'bg-border text-foreground border-border' }
                  const isRollingBack = rollbackId === rev.id
                  const isFirst = i === 0
                  const item: TrailActivityItem = {
                    revisionId: rev.id,
                    trailId: trail.id,
                    trailName: trail.name,
                    action: rev.action,
                    summary: rev.summary,
                    createdAt: new Date(rev.createdAt),
                  }
                  return (
                    <li key={rev.id}>
                      <button
                        type="button"
                        onClick={() => setDiffRevision(item)}
                        className="w-full flex items-start gap-2 rounded-sm px-1 py-0.5 -mx-1 text-left hover:bg-mud/40 transition-colors"
                        title="View geometry diff"
                      >
                        <span
                          className={cn(
                            'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            meta.cls
                          )}
                        >
                          {meta.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">{rev.createdByName ?? 'Unknown'}</span>
                            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(new Date(rev.createdAt))}</span>
                          </div>
                          {rev.summary && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{rev.summary}</p>
                          )}
                        </div>
                      </button>
                      {user && !isFirst && rev.action !== 'delete' && (
                        <div className="flex justify-end mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleRollback(rev.id)}
                            disabled={isRollingBack}
                            title="Rollback to this version"
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                          >
                            {isRollingBack ? (
                              <FontAwesomeIcon icon={faSpinner} spin className="w-3.5 h-3.5" />
                            ) : (
                              <FontAwesomeIcon icon={faRotateLeft} className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
      {/* Revision geometry diff modal */}
      {diffRevision && (
        <ChangeDetailModal
          item={diffRevision}
          trails={[trail]}
          sessionUser={user}
          onClose={() => setDiffRevision(null)}
          onOpenTrail={() => setDiffRevision(null)}
        />
      )}

      {/* Photo lightbox */}
      {lightboxIndex !== null && photos && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[4001] flex items-center justify-center bg-black/80"
          onClick={() => { setLightboxIndex(null); onPhotoClose?.() }}
        >
          <div
            className="relative flex items-center justify-center max-w-4xl w-full px-14"
            onClick={e => e.stopPropagation()}
          >
            {/* Prev */}
            {lightboxIndex > 0 && (
              <button
                type="button"
                onClick={() => {
                  const i = lightboxIndex - 1
                  setLightboxIndex(i)
                  onPhotoOpen?.(photos[i].id)
                }}
                className="absolute left-2 flex items-center justify-center h-10 w-10 text-white/80 hover:text-white transition-colors"
                aria-label="Previous photo"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
              </button>
            )}
            {/* Image */}
            <img
              src={photos[lightboxIndex].blobUrl}
              alt=""
              className="max-h-[80vh] max-w-full w-auto rounded-md shadow-2xl object-contain"
            />
            {/* Next */}
            {lightboxIndex < photos.length - 1 && (
              <button
                type="button"
                onClick={() => {
                  const i = lightboxIndex + 1
                  setLightboxIndex(i)
                  onPhotoOpen?.(photos[i].id)
                }}
                className="absolute right-2 flex items-center justify-center h-10 w-10 text-white/80 hover:text-white transition-colors"
                aria-label="Next photo"
              >
                <FontAwesomeIcon icon={faChevronRight} className="w-5 h-5" />
              </button>
            )}
            {/* Close */}
            <button
              type="button"
              onClick={() => { setLightboxIndex(null); onPhotoClose?.() }}
              className="absolute -top-10 right-2 flex items-center justify-center h-8 w-8 rounded-full bg-black/50 text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-mud/30 transition-colors border-b border-border"
    >
      <span className="font-display text-xs font-normal uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <FontAwesomeIcon
        icon={open ? faChevronDown : faChevronRight}
        className="h-3 w-3 text-muted-foreground"
      />
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}
