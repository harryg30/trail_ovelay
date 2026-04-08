'use client'

export function EndpointControls({
  onStep,
  onClear,
}: {
  onStep: (which: 'start' | 'end', delta: number) => void
  onClear: (which: 'start' | 'end') => void
}) {
  const stepBtn =
    'flex h-7 w-7 items-center justify-center rounded-sm border-2 border-border text-xs font-bold text-foreground transition-colors hover:bg-mud/80 active:bg-mud'
  const clearBtn =
    'ml-auto flex h-7 items-center rounded-sm border-2 border-border px-2 text-xs text-muted-foreground transition-colors hover:border-destructive hover:text-destructive'

  const row = (label: string, which: 'start' | 'end') => (
    <div className="flex items-center gap-1.5">
      <span className="w-8 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <button type="button" className={stepBtn} onClick={() => onStep(which, -1)} title="Step back">
        ←
      </button>
      <button type="button" className={stepBtn} onClick={() => onStep(which, 1)} title="Step forward">
        →
      </button>
      <button type="button" className={clearBtn} onClick={() => onClear(which)}>
        Clear
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-1.5 rounded-md border-2 border-border bg-mud/35 px-2.5 py-2">
      {row('Start', 'start')}
      {row('End', 'end')}
    </div>
  )
}
