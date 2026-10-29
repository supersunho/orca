import React from 'react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import type { GitHistoryItemViewModel } from '../../../../shared/git-history-graph'
import {
  GitHistoryGraphSvg,
  graphColor
} from '../right-sidebar/source-control/sync/git-history-graph-svg'

function refCategoryLabel(ref: GitHistoryItemRef): string {
  return ref.category ? `${ref.name} (${ref.category})` : ref.name
}

export function GitGraphRow({
  viewModel,
  worktreeHeads,
  selected,
  activeRefFilter,
  onSelect,
  onToggleRefFilter
}: {
  viewModel: GitHistoryItemViewModel
  worktreeHeads: ReadonlyMap<string, readonly string[]>
  selected: boolean
  activeRefFilter: readonly string[]
  onSelect: (item: GitHistoryItem, event?: React.MouseEvent) => void
  onToggleRefFilter: (ref: GitHistoryItemRef) => void
}): React.JSX.Element {
  const item = viewModel.historyItem
  const heads = worktreeHeads.get(item.id) ?? []
  const refs = item.references ?? []
  const visibleRefs = refs.slice(0, 3)
  const hiddenRefs = refs.slice(3)
  const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="git-graph-row"
      data-commit-id={item.id}
      aria-pressed={selected}
      onClick={(event) => onSelect(item, event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(item)
        }
      }}
      className={cn(
        'grid min-h-[28px] w-full min-w-0 cursor-pointer grid-cols-[76px_minmax(0,1fr)_132px_96px_76px] items-center gap-x-2 border-b border-border/40 px-2 py-0.5 text-xs outline-none',
        'hover:bg-accent/40 focus-visible:bg-accent/50',
        selected && 'bg-accent/60'
      )}
    >
      <div className="flex h-7 items-center overflow-hidden">
        <GitHistoryGraphSvg viewModel={viewModel} />
      </div>

      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        {heads.length > 0 && (
          <span
            className="shrink-0 rounded-sm bg-status-success-background px-1 py-0.5 text-[10px] font-medium text-status-success"
            title={translate(
              'auto.components.git.graph.row.worktreeHead',
              'Worktree HEAD: {{value0}}',
              { value0: heads.join(', ') }
            )}
          >
            {translate('auto.components.git.graph.row.head', 'HEAD')}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate" title={item.message || item.subject}>
          {item.subject}
        </span>
        <div className="flex shrink-0 items-center gap-1 overflow-hidden">
          {visibleRefs.map((ref) => {
            const active = activeRefFilter.includes(ref.id)
            return (
              <button
                key={ref.id}
                type="button"
                title={translate(
                  'auto.components.git.graph.row.filterRef',
                  '{{value0}} — click to filter',
                  { value0: refCategoryLabel(ref) }
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleRefFilter(ref)
                }}
                className={cn(
                  'max-w-[9rem] truncate rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                  active && 'ring-1 ring-current'
                )}
                style={{
                  borderColor: ref.color ? graphColor(ref.color) : 'var(--border)',
                  color: ref.color ? graphColor(ref.color) : 'var(--muted-foreground)'
                }}
              >
                {ref.name}
              </button>
            )
          })}
          {hiddenRefs.length > 0 && (
            <span
              className="shrink-0 text-[10px] text-muted-foreground"
              title={hiddenRefs.map((ref) => ref.name).join(', ')}
            >
              +{hiddenRefs.length}
            </span>
          )}
        </div>
      </div>

      <span className="truncate text-muted-foreground" title={item.author}>
        {item.author ?? ''}
      </span>
      <span className="truncate text-muted-foreground" title={timestamp}>
        {timestamp}
      </span>
      <span className="truncate font-mono text-[10px] text-muted-foreground">
        {item.displayId ?? item.id.slice(0, 7)}
      </span>
    </div>
  )
}
