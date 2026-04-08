'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

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
  }

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
      <Button
        type="button"
        variant={confirming ? 'destructive' : 'outlineThick'}
        className={confirming ? 'border-destructive bg-destructive text-destructive-foreground hover:brightness-110' : 'border-destructive/50 text-destructive'}
        onClick={handleClick}
        disabled={disabled || deleting}
      >
        {deleting ? `Deleting…` : confirming ? 'Confirm Delete' : `Delete ${entityLabel}`}
      </Button>
      {confirming && !deleting && (
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="-mt-0.5 text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Cancel delete
        </button>
      )}
    </div>
  )
}
