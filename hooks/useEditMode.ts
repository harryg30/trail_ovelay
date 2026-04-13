'use client'

import { useState, useCallback, useRef } from 'react'
import type { EditMode, TrimPoint, Trail, Network } from '@/lib/types'
import type { TrailEditTool } from '@/lib/modes/types'

/**
 * Owns all mode-scoped state and the setMode transition function.
 *
 * Draw-trail points and OSM selection have moved to useStagedTrail.
 * Trim state is still here because it's shared between the GPX sub-tool
 * inside add-trail and the averaged-line flow in ClientPage.
 */
export function useEditMode() {
  const [editMode, setEditModeRaw] = useState<EditMode>(null)

  // Trim mode state (add-trail / gpx sub-tool)
  const [trimStart, setTrimStart] = useState<TrimPoint | null>(null)
  const [trimEnd, setTrimEnd] = useState<TrimPoint | null>(null)
  const trimEndRef = useRef<TrimPoint | null>(null)
  trimEndRef.current = trimEnd

  // Edit/refine trail state (edit-trail, refine-trail)
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)
  const [refinedPolyline, setRefinedPolyline] = useState<[number, number][] | null>(null)
  const [savingRefined, setSavingRefined] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)
  const [refineTrailHistoryPast, setRefineTrailHistoryPast] = useState<[number, number][][]>([])
  const [refineTrailHistoryFuture, setRefineTrailHistoryFuture] = useState<[number, number][][]>([])

  // Shared tool state for edit-trail refine
  const [trailEditTool, setTrailEditTool] = useState<TrailEditTool>('pencil')

  // Network state (add-network, edit-network)
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [drawNetworkPoints, setDrawNetworkPoints] = useState<[number, number][]>([])

  const setMode = useCallback((mode: EditMode) => {
    setEditModeRaw(mode)

    if (mode !== 'add-trail') {
      setTrimStart(null)
      setTrimEnd(null)
    }
    if (mode !== 'edit-trail') {
      setSelectedTrail(null)
      setRefinedPolyline(null)
      setRefineError(null)
      setRefineTrailHistoryPast([])
      setRefineTrailHistoryFuture([])
    }
    if (mode !== 'add-network' && mode !== 'edit-network') {
      setSelectedNetwork(null)
      setDrawNetworkPoints([])
    }
    if (mode !== 'add-network') {
      setDrawNetworkPoints([])
    }
    if (mode !== 'edit-trail') {
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

    trailEditTool, setTrailEditTool,

    selectedNetwork, setSelectedNetwork,
    drawNetworkPoints, setDrawNetworkPoints,
  }
}
