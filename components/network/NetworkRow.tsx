'use client'

import { useState } from 'react'
import type { Trail, Network } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faEye, faEyeSlash, faPenToSquare } from '@fortawesome/free-solid-svg-icons'

export function NetworkRow({
  network,
  trails,
  isSelected,
  isHidden,
  onToggleVisibility,
  onEdit,
  user,
}: {
  network: Network
  trails: Trail[]
  isSelected: boolean
  isHidden: boolean
  onToggleVisibility: () => void
  onEdit: () => void
  user: SessionUser | null
}) {
  const [expanded, setExpanded] = useState(false)
  const networkTrails = trails.filter((t) => network.trailIds.includes(t.id))

  return (
    <li className={`flex flex-col rounded-md bg-zinc-50 text-sm ${isSelected ? 'ring-1 ring-blue-400' : ''} ${isHidden ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between py-2 px-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-zinc-800 truncate text-left min-w-0"
        >
          <FontAwesomeIcon
            icon={faChevronRight}
            className={`w-3 h-3 shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <span className="truncate">{network.name}</span>
        </button>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-zinc-400 text-xs">{network.trailIds.length} trails</span>
          <button
            type="button"
            onClick={onToggleVisibility}
            title={isHidden ? 'Show on map' : 'Hide from map'}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <FontAwesomeIcon icon={isHidden ? faEyeSlash : faEye} className="w-4 h-4" />
          </button>
          {user && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit network"
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-0.5">
          {networkTrails.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">No trails assigned</p>
          ) : (
            networkTrails.map((t) => (
              <p key={t.id} className="text-xs text-zinc-600 truncate pl-4">• {t.name}</p>
            ))
          )}
        </div>
      )}
    </li>
  )
}
