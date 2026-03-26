'use client'

import { useState } from 'react'

/**
 * Two-stage delete button. First click shows "Confirm Delete", second click
 * calls onDelete(). Owns its own confirmDelete + error state internally.
 *
 * onDelete returns null on success or an error string to display inline.
 */
export function ConfirmDeleteButton({
  onDelete,
  disabled,
  entityLabel,
}: {
  onDelete: () => Promise<string | null>
  disabled: boolean
  entityLabel: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    setError(null)
    const err = await onDelete()
    if (err) {
      setError(err)
      setDeleting(false)
      setConfirming(false)
    }
    // On success the caller unmounts this component, so no reset needed.
  }

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || deleting}
        className={`w-full py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          confirming
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'border border-red-200 text-red-500 hover:bg-red-50'
        }`}
      >
        {deleting ? `Deleting…` : confirming ? 'Confirm Delete' : `Delete ${entityLabel}`}
      </button>
      {confirming && !deleting && (
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600 text-center -mt-0.5"
        >
          Cancel delete
        </button>
      )}
    </div>
  )
}
