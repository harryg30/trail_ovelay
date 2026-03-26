'use client'

import { useState } from 'react'
import type { Trail, Network } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-3 h-3 shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
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
            {isHidden ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
                <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {user && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit network"
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
              </svg>
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
