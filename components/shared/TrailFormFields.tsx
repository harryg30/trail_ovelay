'use client'

import type { TrimFormState } from '@/lib/types'

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
  const inputCls =
    'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-800 focus:outline-none focus:border-orange-400 disabled:opacity-50 disabled:cursor-not-allowed'

  const field = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  )

  return (
    <>
      {field(
        'Name *',
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          className={inputCls}
          disabled={disabled}
          required
        />
      )}

      {field(
        'Difficulty',
        <select
          value={form.difficulty}
          onChange={(e) => onChange({ ...form, difficulty: e.target.value as TrimFormState['difficulty'] })}
          className={inputCls}
          disabled={disabled}
        >
          <option value="not_set">Not set</option>
          <option value="easy">Easy</option>
          <option value="intermediate">Intermediate</option>
          <option value="hard">Hard</option>
        </select>
      )}

      {field(
        'Direction',
        <select
          value={form.direction}
          onChange={(e) => onChange({ ...form, direction: e.target.value as TrimFormState['direction'] })}
          className={inputCls}
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
        <textarea
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Optional"
          disabled={disabled}
        />
      )}
    </>
  )
}
