'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'

/** Horizontally centered at top; v3 clears offsets from the top-left experiment (v2). */
const STORAGE_KEY = 'trail-overlay:add-trail-tools-panel-offset-v3'

type Offset = { x: number; y: number }

function clampOffset(x: number, y: number): Offset {
  if (typeof window === 'undefined') return { x, y }
  const maxX = window.innerWidth * 0.45
  const maxY = window.innerHeight * 0.88
  return {
    x: Math.round(Math.max(-maxX, Math.min(maxX, x))),
    y: Math.round(Math.max(-60, Math.min(maxY, y))),
  }
}

/**
 * Map overlay shell (centered below top edge) with a drag handle, persisted offset, and clamped bounds.
 */
export function FloatingDraggableToolsPanel({ children, title = 'Tools' }: { children: ReactNode; title?: string }) {
  const initialOffset: Offset = (() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return { x: 0, y: 0 }
      const o = JSON.parse(raw) as Partial<Offset>
      if (typeof o.x === 'number' && typeof o.y === 'number') {
        return clampOffset(o.x, o.y)
      }
    } catch {
      /* ignore */
    }
    return { x: 0, y: 0 }
  })()

  const [offset, setOffset] = useState<Offset>(() => initialOffset)
  const offsetRef = useRef<Offset>(initialOffset)
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      px: e.clientX,
      py: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const nx = d.ox + (e.clientX - d.px)
    const ny = d.oy + (e.clientY - d.py)
    const c = clampOffset(nx, ny)
    offsetRef.current = c
    setOffset(c)
  }, [])

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(offsetRef.current))
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <div
      className="pointer-events-auto absolute left-1/2 top-3 z-[1002] select-none"
      style={{
        transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`,
      }}
    >
      <div className="flex min-w-[min(100%,19rem)] max-w-[min(96vw,36rem)] flex-col overflow-hidden rounded-lg border-2 border-foreground bg-card shadow-[3px_3px_0_0_var(--foreground)]">
        <div
          className="flex touch-none cursor-grab flex-nowrap items-center justify-center gap-2 whitespace-nowrap border-b border-border bg-muted/40 py-1.5 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag to move"
        >
          <span className="text-muted-foreground" aria-hidden>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor">
              <circle cx="3" cy="2" r="1.2" />
              <circle cx="8" cy="2" r="1.2" />
              <circle cx="13" cy="2" r="1.2" />
              <circle cx="3" cy="8" r="1.2" />
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="13" cy="8" r="1.2" />
            </svg>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        </div>
        {children}
      </div>
    </div>
  )
}
