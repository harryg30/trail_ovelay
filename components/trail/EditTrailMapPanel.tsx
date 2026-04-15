'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEraser,
  faPencil,
  faRotateLeft,
  faRotateRight,
  faScissors,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { TrailEditTool } from '@/lib/modes/types'
import { polylineDistanceKm } from '@/lib/geo-utils'

const toolBtn = (active: boolean) =>
  cn(
    'flex size-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
    active
      ? 'border-foreground bg-foreground text-background'
      : 'border-border bg-card text-foreground hover:bg-mud/80'
  )

const tabBtn = (active: boolean) =>
  cn(
    'inline-flex min-w-[4.5rem] flex-1 basis-0 items-center justify-center gap-1.5 whitespace-nowrap py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors border-b-2',
    active
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  )

interface EditTrailMapPanelProps {
  trailEditTool: TrailEditTool
  onSetTool: (t: TrailEditTool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  polyline: [number, number][] | null
  onCancel: () => void
  rootClassName?: string
}

export function EditTrailMapPanel({
  trailEditTool,
  onSetTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  polyline,
  onCancel,
  rootClassName,
}: EditTrailMapPanelProps) {
  const pts = polyline?.length ?? 0
  const distKm = pts >= 2 ? polylineDistanceKm(polyline!) : 0

  return (
    <div
      className={cn(
        'flex w-[min(96vw,36rem)] flex-col gap-0 rounded-lg border-2 border-foreground bg-card shadow-[3px_3px_0_0_var(--foreground)]',
        rootClassName
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tab bar */}
      <div className="flex min-w-0 overflow-x-auto border-b border-border">
        <button type="button" className={tabBtn(true)}>
          <FontAwesomeIcon icon={faPencil} className="h-3 w-3 shrink-0" />
          Draw
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="Cancel edit"
          className="shrink-0 px-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tool content */}
      <div className="px-3 py-2 flex flex-col gap-2">
        {/* History row */}
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            History
          </span>
          <button
            type="button"
            title="Undo"
            className={toolBtn(false)}
            onClick={onUndo}
            disabled={!canUndo}
          >
            <FontAwesomeIcon icon={faRotateLeft} className={cn('h-3 w-3', !canUndo && 'opacity-40')} />
          </button>
          <button
            type="button"
            title="Redo"
            className={toolBtn(false)}
            onClick={onRedo}
            disabled={!canRedo}
          >
            <FontAwesomeIcon icon={faRotateRight} className={cn('h-3 w-3', !canRedo && 'opacity-40')} />
          </button>
          <Button type="button" variant="outlineThick" size="xs" onClick={onClear} disabled={pts === 0}>
            Clear
          </Button>
        </div>

        {/* Draw tools row */}
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
          <button
            type="button"
            title="Pencil"
            className={toolBtn(trailEditTool === 'pencil')}
            onClick={() => onSetTool('pencil')}
          >
            <FontAwesomeIcon icon={faPencil} className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Eraser"
            className={toolBtn(trailEditTool === 'eraser')}
            onClick={() => onSetTool('eraser')}
          >
            <FontAwesomeIcon icon={faEraser} className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Section eraser"
            className={toolBtn(trailEditTool === 'section-eraser')}
            onClick={() => onSetTool('section-eraser')}
          >
            <FontAwesomeIcon icon={faScissors} className="h-3 w-3" />
          </button>
          <p className="ml-auto max-w-[12rem] text-right text-[10px] leading-snug text-muted-foreground">
            {pts > 0
              ? `${pts} pts · ${distKm.toFixed(2)} km`
              : 'Loading…'}
          </p>
        </div>

        {/* Hint */}
        <p className="text-[10px] leading-snug text-muted-foreground">
          {trailEditTool === 'section-eraser'
            ? 'Click two points to erase the section between them.'
            : 'Pencil: click line or drag points to edit. Eraser: remove a point.'}
        </p>
      </div>
    </div>
  )
}
