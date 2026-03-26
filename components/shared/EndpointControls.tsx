'use client'

export function EndpointControls({
  onStep,
  onClear,
}: {
  onStep: (which: 'start' | 'end', delta: number) => void
  onClear: (which: 'start' | 'end') => void
}) {
  const stepBtn =
    'w-7 h-7 flex items-center justify-center rounded border border-zinc-200 text-zinc-600 text-xs hover:bg-zinc-50 active:bg-zinc-100 transition-colors'
  const clearBtn =
    'ml-auto px-2 h-7 flex items-center rounded border border-zinc-200 text-zinc-400 text-xs hover:border-red-300 hover:text-red-500 transition-colors'

  const row = (label: string, which: 'start' | 'end') => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 w-8 shrink-0">{label}</span>
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
    <div className="flex flex-col gap-1.5 py-2 px-2.5 rounded-md bg-zinc-50 border border-zinc-100">
      {row('Start', 'start')}
      {row('End', 'end')}
    </div>
  )
}
