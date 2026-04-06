'use client'

import { useState, useCallback, useRef } from 'react'
import type { EditMode, TrimPoint, Trail, Network } from '@/lib/types'

/**
 * Owns all mode-scoped state and the setMode transition function.
 *
 * setMode() replaces the old handleEditModeChange pattern: it atomically
 * switches the active mode AND clears state that doesn't carry over to the
 * new mode, preventing stale values from leaking between modes.
 *
 * To understand which state belongs to which mode, see lib/modes/types.ts
 * and docs/MODE_SYSTEM.md.
 */
export function useEditMode() {
  const [editMode, setEditModeRaw] = useState<EditMode>(null)

  // Trim mode state (add-trail)
  const [trimStart, setTrimStart] = useState<TrimPoint | null>(null)
  const [trimEnd, setTrimEnd] = useState<TrimPoint | null>(null)
  // Stable ref so trimStart updater callbacks can read current trimEnd
  const trimEndRef = useRef<TrimPoint | null>(null)
  trimEndRef.current = trimEnd

  // Edit/refine trail state (edit-trail, refine-trail)
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)
  const [refinedPolyline, setRefinedPolyline] = useState<[number, number][] | null>(null)
  const [savingRefined, setSavingRefined] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  // Network state (add-network, edit-network)
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [drawNetworkPoints, setDrawNetworkPoints] = useState<[number, number][]>([])

  // Draw trail state (draw-trail)
  const [drawTrailPoints, setDrawTrailPoints] = useState<[number, number][]>([])
  const [drawTrailFinished, setDrawTrailFinished] = useState(false)

  /**
   * Transition to a new mode, clearing any state that doesn't carry over.
   * Use this instead of calling setEditMode directly.
   */
  const setMode = useCallback((mode: EditMode) => {
    setEditModeRaw(mode)

    if (mode !== 'add-trail') {
      setTrimStart(null)
      setTrimEnd(null)
    }
    if (mode !== 'edit-trail' && mode !== 'refine-trail') {
      setSelectedTrail(null)
    }
    if (mode !== 'refine-trail') {
      setRefinedPolyline(null)
      setRefineError(null)
    }
    if (mode !== 'add-network' && mode !== 'edit-network') {
      setSelectedNetwork(null)
      setDrawNetworkPoints([])
    }
    if (mode !== 'add-network') {
      setDrawNetworkPoints([])
    }
    if (mode !== 'draw-trail') {
      setDrawTrailPoints([])
      setDrawTrailFinished(false)
    }
  }, [])

  return {
    editMode,
    setMode,

    trimStart, setTrimStart,
    trimEnd, setTrimEnd,
    trimEndRef,

    selectedTrail, setSelectedTrail,
    refinedPolyline, setRefinedPolyline,
    savingRefined, setSavingRefined,
    refineError, setRefineError,

    selectedNetwork, setSelectedNetwork,
    drawNetworkPoints, setDrawNetworkPoints,

    drawTrailPoints, setDrawTrailPoints,
    drawTrailFinished, setDrawTrailFinished,
  }
}
