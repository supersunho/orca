import React from 'react'
import { Archive, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { GitGraphStash } from '../../../../shared/git-graph-actions'

export function GitGraphUncommittedRow({
  changeCount,
  statusCapped = false,
  busy = false,
  onStash
}: {
  changeCount: number
  statusCapped?: boolean
  busy?: boolean
  onStash: () => void
}): React.JSX.Element {
  return (
    <div
      data-testid="git-graph-aux-row"
      data-aux-row="uncommitted"
      className="flex min-h-[28px] items-center gap-2 border-b border-border/40 bg-muted/20 px-2 py-0.5 text-xs"
    >
      <span className="flex w-[76px] shrink-0 items-center justify-center">
        <CircleDot className="size-3.5 text-annotation-highlight" />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {statusCapped
          ? translate(
              'auto.components.git.graph.aux.uncommittedChangesCapped',
              'Uncommitted changes ({{value0}}+)',
              { value0: String(changeCount) }
            )
          : translate(
              'auto.components.git.graph.aux.uncommittedChanges',
              'Uncommitted changes ({{value0}})',
              { value0: String(changeCount) }
            )}
      </span>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onStash}>
        {translate('auto.components.git.graph.sync.stash', 'Stash')}
      </Button>
    </div>
  )
}

export function GitGraphStashRow({
  stash,
  busy = false,
  onApply
}: {
  stash: GitGraphStash
  busy?: boolean
  onApply: () => void
}): React.JSX.Element {
  return (
    <div
      data-testid="git-graph-aux-row"
      data-aux-row="stash"
      className="flex min-h-[28px] items-center gap-2 border-b border-border/40 px-2 py-0.5 text-xs"
    >
      <span className="flex w-[76px] shrink-0 items-center justify-center">
        <Archive className="size-3.5 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-mono text-[10px] text-muted-foreground">
          {translate('auto.components.git.graph.aux.stashPrefix', 'stash@')}
          {stash.index}
        </span>{' '}
        {stash.message}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {stash.createdAt ? new Date(stash.createdAt).toLocaleDateString() : ''}
      </span>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onApply}>
        {translate('auto.components.git.graph.aux.apply', 'Apply')}
      </Button>
    </div>
  )
}
