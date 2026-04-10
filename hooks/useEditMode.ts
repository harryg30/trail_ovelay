'use client'

import { useState, useCallback, useRef } from 'react'
import type { EditMode, TrimPoint, Trail, Network } from '@/lib/types'
import type { TrailEditTool } from '@/lib/modes/types'

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
  const [refineTrailHistoryPast, setRefineTrailHistoryPast] = useState<[number, number][][]>([])
  const [refineTrailHistoryFuture, setRefineTrailHistoryFuture] = useState<[number, number][][]>([])

  // Network state (add-network, edit-network, network-map)
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [drawNetworkPoints, setDrawNetworkPoints] = useState<[number, number][]>([])
  const [drawNetworkHistoryPast, setDrawNetworkHistoryPast] = useState<[number, number][][]>([])
  const [drawNetworkHistoryFuture, setDrawNetworkHistoryFuture] = useState<[number, number][][]>([])

  // Draw trail state (draw-trail)
  const [drawTrailPoints, setDrawTrailPoints] = useState<[number, number][]>([])
  const [drawTrailFinished, setDrawTrailFinished] = useState(false)
  const [drawTrailHistoryPast, setDrawTrailHistoryPast] = useState<[number, number][][]>([])
  const [drawTrailHistoryFuture, setDrawTrailHistoryFuture] = useState<[number, number][][]>([])

  // Shared tool state for draw-trail + refine-trail
  const [trailEditTool, setTrailEditTool] = useState<TrailEditTool>('pencil')

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
    // Photo mode should not require trail-edit state; switching away from edit-trail must clear it.
    if (mode !== 'edit-trail') {
      setSelectedTrail(null)
    }
    if (mode !== 'edit-trail') {
      setRefinedPolyline(null)
      setRefineError(null)
      setRefineTrailHistoryPast([])
      setRefineTrailHistoryFuture([])
    }
    if (mode !== 'add-network' && mode !== 'edit-network' && mode !== 'network-map') {
      setSelectedNetwork(null)
    }
    if (mode !== 'add-network') {
      setDrawNetworkPoints([])
      setDrawNetworkHistoryPast([])
      setDrawNetworkHistoryFuture([])
    }
    if (mode !== 'draw-trail') {
      setDrawTrailPoints([])
      setDrawTrailFinished(false)
      setDrawTrailHistoryPast([])
      setDrawTrailHistoryFuture([])
    }

    if (mode !== 'draw-trail' && mode !== 'edit-trail' && mode !== 'add-network') {
      setTrailEditTool('pencil')
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
    refineTrailHistoryPast, setRefineTrailHistoryPast,
    refineTrailHistoryFuture, setRefineTrailHistoryFuture,

    selectedNetwork, setSelectedNetwork,
    drawNetworkPoints, setDrawNetworkPoints,
    drawNetworkHistoryPast, setDrawNetworkHistoryPast,
    drawNetworkHistoryFuture, setDrawNetworkHistoryFuture,

    drawTrailPoints, setDrawTrailPoints,
    drawTrailFinished, setDrawTrailFinished,
    drawTrailHistoryPast, setDrawTrailHistoryPast,
    drawTrailHistoryFuture, setDrawTrailHistoryFuture,

    trailEditTool, setTrailEditTool,
  }
}
