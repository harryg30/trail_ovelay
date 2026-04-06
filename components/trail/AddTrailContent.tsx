'use client'

import { useState } from 'react'
import type { TrimPoint, TrimSegment, TrimFormState, Network } from '@/lib/types'
import { EndpointControls } from '@/components/shared/EndpointControls'
import { TrimForm } from '@/components/trail/TrimForm'

export function AddTrailContent({
  trimStart,
  trimSegment,
  onSaveTrail,
  onCancel,
  canPublish,
  onStepTrimPoint,
  onClearTrimPoint,
  averagedTrimPolyline,
  averagedRideCount,
  onClearAveragedTrim,
  corridorRadiusKm,
  onCorridorRadiusChange,
  outputSpacingKm,
  onOutputSpacingChange,
  hasUnfetchedStravaRides,
  onAverageLine,
  onFetchHighResForCorridor,
  fetchingHighResForCorridor,
  networks,
}: {
  trimStart: TrimPoint | null
  trimSegment: TrimSegment | null
  onSaveTrail: (form: TrimFormState, publishOnSave: boolean) => Promise<string | null>
  canPublish?: boolean
  onCancel: () => void
  onStepTrimPoint: (which: 'start' | 'end', delta: number) => void
  onClearTrimPoint: (which: 'start' | 'end') => void
  averagedTrimPolyline: [number, number][] | null
  averagedRideCount: number
  onClearAveragedTrim: () => void
  corridorRadiusKm: number
  onCorridorRadiusChange: (v: number) => void
  outputSpacingKm: number
  onOutputSpacingChange: (v: number) => void
  hasUnfetchedStravaRides: boolean
  onAverageLine: () => void
  onFetchHighResForCorridor: () => Promise<void>
  fetchingHighResForCorridor: boolean
  networks: Network[]
}) {
  const [pendingCorridorFetch, setPendingCorridorFetch] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      {!trimStart && (
        <p className="text-xs text-zinc-500">Click a ride on the map to set the start point.</p>
      )}
      {trimStart && !trimSegment && (
        <p className="text-xs text-orange-600 font-medium">
          Start set — click to set the end point.
        </p>
      )}
      {trimSegment && (
        <EndpointControls onStep={onStepTrimPoint} onClear={onClearTrimPoint} />
      )}
      {trimSegment && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <label htmlFor="corridor-slider" className="shrink-0">Corridor</label>
          <input
            id="corridor-slider"
            type="range"
            min={5}
            max={50}
            step={5}
            value={Math.round(corridorRadiusKm * 1000)}
            onChange={(e) => onCorridorRadiusChange(Number(e.target.value) / 1000)}
            className="flex-1"
          />
          <span className="w-8 text-right shrink-0">{Math.round(corridorRadiusKm * 1000)}m</span>
        </div>
      )}
      {trimSegment && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <label htmlFor="spacing-slider" className="shrink-0">Resolution</label>
          <input
            id="spacing-slider"
            type="range"
            min={3}
            max={20}
            step={1}
            value={Math.round(outputSpacingKm * 1000)}
            onChange={(e) => onOutputSpacingChange(Number(e.target.value) / 1000)}
            className="flex-1"
          />
          <span className="w-8 text-right shrink-0">{Math.round(outputSpacingKm * 1000)}m</span>
        </div>
      )}
      {trimSegment && hasUnfetchedStravaRides && (
        pendingCorridorFetch ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Fetches nearby Strava rides (1 API call each, limit 200/day). Data is stored in memory only.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setPendingCorridorFetch(false); onFetchHighResForCorridor() }}
                className="flex-1 py-1 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors"
              >
                Fetch
              </button>
              <button
                type="button"
                onClick={() => setPendingCorridorFetch(false)}
                className="px-3 py-1 rounded border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={fetchingHighResForCorridor}
            onClick={() => setPendingCorridorFetch(true)}
            className="w-full py-1.5 rounded-md border border-blue-200 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fetchingHighResForCorridor ? 'Fetching from Strava…' : '↑ Improve from Strava'}
          </button>
        )
      )}
      {trimSegment && !averagedTrimPolyline && (
        <button
          type="button"
          onClick={onAverageLine}
          className="w-full py-1.5 rounded-md border border-fuchsia-200 text-xs text-fuchsia-700 hover:bg-fuchsia-50 transition-colors"
        >
          Average line
        </button>
      )}
      {trimSegment && averagedTrimPolyline && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-fuchsia-50 border border-fuchsia-200 text-xs">
          <span className="text-fuchsia-700 font-medium">
            Averaged from {averagedRideCount} ride{averagedRideCount !== 1 ? 's' : ''} · magenta line
          </span>
          <div className="flex gap-2 ml-2">
            <button
              type="button"
              onClick={onAverageLine}
              className="text-fuchsia-400 hover:text-fuchsia-600 transition-colors"
              title="Re-run averaging"
            >
              Re-run
            </button>
            <button
              type="button"
              onClick={onClearAveragedTrim}
              className="text-fuchsia-400 hover:text-fuchsia-600 transition-colors"
              title="Discard averaged line, save raw trim instead"
            >
              Discard
            </button>
          </div>
        </div>
      )}
      <TrimForm
        trimSegment={trimSegment}
        onSave={onSaveTrail}
        onCancel={onCancel}
        disabled={!trimSegment}
        networks={networks}
        canPublish={canPublish}
      />
    </div>
  )
}
