import type { ReactElement } from 'react'
import { translate } from '@/i18n/i18n'
import { shortRefName } from './git-graph-row-refs'

/** Active branch-filter chips with a clear-all affordance. */
export function GitGraphBranchFilterChips({
  refFilter,
  onRemove,
  onClear
}: {
  refFilter: readonly string[]
  onRemove: (ref: string) => void
  onClear: () => void
}): ReactElement | null {
  if (refFilter.length === 0) {
    return null
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-3 py-1">
      {refFilter.map((ref) => (
        <button
          key={ref}
          type="button"
          className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
          onClick={() => onRemove(ref)}
        >
          {shortRefName(ref)}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button
        type="button"
        className="px-1 text-[10px] text-muted-foreground hover:text-foreground"
        onClick={onClear}
      >
        {translate('auto.components.git.graph.pane.clearFilters', 'Clear filters')}
      </button>
    </div>
  )
}
