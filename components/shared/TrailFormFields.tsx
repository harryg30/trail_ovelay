'use client'

import type { ReactNode } from 'react'
import type { TrimFormState } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/**
 * Shared controlled field set for trail name, difficulty, direction, and notes.
 * Used by both TrimForm (add-trail) and EditTrailForm (edit-trail).
 * Does not include a form tag, submit button, or stats display — callers own those.
 */
export function TrailFormFields({
  form,
  onChange,
  disabled,
}: {
  form: TrimFormState
  onChange: (form: TrimFormState) => void
  disabled: boolean
}) {
  const selectCls =
    'h-9 w-full rounded-md border-2 border-foreground bg-card px-2 py-1 text-sm font-medium text-foreground shadow-[inset_2px_2px_0_0_var(--mud)] disabled:cursor-not-allowed disabled:opacity-50'

  const field = (label: string, children: ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  )

  return (
    <>
      {field(
        'Name *',
        <Input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          disabled={disabled}
          required
        />
      )}

      {field(
        'Difficulty',
        <select
          value={form.difficulty}
          onChange={(e) => onChange({ ...form, difficulty: e.target.value as TrimFormState['difficulty'] })}
          className={cn(selectCls)}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="easy">● Green Circle</option>
          <option value="intermediate">■ Blue Square</option>
          <option value="hard">◆ Black Diamond</option>
          <option value="pro">◆◆ Double Black Diamond</option>
        </select>
      )}

      {field(
        'Direction',
        <select
          value={form.direction}
          onChange={(e) => onChange({ ...form, direction: e.target.value as TrimFormState['direction'] })}
          className={cn(selectCls)}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="one-way">One-way</option>
          <option value="out-and-back">Out and back</option>
          <option value="loop">Loop</option>
        </select>
      )}

      {field(
        'Notes',
        <Textarea
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          rows={2}
          className="resize-none"
          placeholder="Optional"
          disabled={disabled}
        />
      )}
    </>
  )
}
