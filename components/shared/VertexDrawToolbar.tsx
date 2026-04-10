'use client'

import type { TrailEditTool } from '@/lib/modes/types'
import { Button } from '@/components/ui/button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEraser, faPencil, faRotateLeft, faRotateRight } from '@fortawesome/free-solid-svg-icons'

const toolBtnActive = 'border-2 border-foreground bg-foreground text-background'
const toolBtnIdle = 'border-2 border-border bg-card text-foreground hover:bg-mud/80'
const iconActionBtn =
  'rounded-md border-2 border-border bg-card p-2 text-foreground transition-colors hover:bg-mud/80 disabled:cursor-not-allowed disabled:opacity-40'

const toolBase =
  'flex items-center justify-center rounded-md border-2 p-2 transition-colors'

/**
 * Pencil / eraser / undo / redo / clear — shared by draw-trail, refine-trail, and draw-network polygon flows.
 */
export function VertexDrawToolbar({
  trailEditTool,
  onSetTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  hint,
}: {
  trailEditTool: TrailEditTool
  onSetTool: (t: TrailEditTool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  hint: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-display text-xs font-normal uppercase tracking-[0.15em] text-muted-foreground">Tools</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          title="Pencil"
          aria-label="Pencil tool"
          aria-pressed={trailEditTool === 'pencil'}
          onClick={() => onSetTool('pencil')}
          className={`${toolBase} ${trailEditTool === 'pencil' ? toolBtnActive : toolBtnIdle}`}
        >
          <FontAwesomeIcon icon={faPencil} className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Eraser"
          aria-label="Eraser tool"
          aria-pressed={trailEditTool === 'eraser'}
          onClick={() => onSetTool('eraser')}
          className={`${toolBase} ${trailEditTool === 'eraser' ? toolBtnActive : toolBtnIdle}`}
        >
          <FontAwesomeIcon icon={faEraser} className="w-4 h-4" />
        </button>
        <button type="button" className={iconActionBtn} onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo">
          <FontAwesomeIcon icon={faRotateLeft} className="w-4 h-4" />
        </button>
        <button type="button" className={iconActionBtn} onClick={onRedo} disabled={!canRedo} title="Redo" aria-label="Redo">
          <FontAwesomeIcon icon={faRotateRight} className="w-4 h-4" />
        </button>
        <Button type="button" variant="outlineThick" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  )
}
