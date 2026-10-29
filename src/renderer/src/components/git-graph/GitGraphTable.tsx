import React from 'react'
import type {
  GitHistoryItem,
  GitHistoryItemRef,
  GitHistoryResult
} from '../../../../shared/git-history'
import type { GitHistoryItemViewModel } from '../../../../shared/git-history-graph'
import type { GitGraphStash } from '../../../../shared/git-graph-actions'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { GitGraphActionMenu, type GitGraphActionMenuHandlers } from './GitGraphActionMenu'
import { GitGraphStashRow, GitGraphUncommittedRow } from './GitGraphAuxRows'
import { GitGraphRow } from './GitGraphRow'
import { gitGraphGridTemplate, type GitGraphViewSettings } from './git-graph-view-settings'

export function GitGraphTable({
  status,
  result,
  error,
  viewSettings,
  viewModels,
  worktreeHeads,
  actionContextHeadId,
  selectedIds,
  activeRefFilter,
  hasWorkingTreeChanges,
  workingTreeChangeCount,
  statusCapped,
  statusReadError,
  showStashRows,
  stashes,
  actionBusy,
  onStash,
  onApplyStash,
  onSelect,
  onToggleRefFilter,
  menuHandlers,
  onLoadMore
}: {
  status: 'idle' | 'loading' | 'refreshing' | 'error'
  result: GitHistoryResult | null
  error: string | null
  viewSettings: GitGraphViewSettings
  viewModels: readonly GitHistoryItemViewModel[]
  worktreeHeads: ReadonlyMap<string, readonly string[]>
  actionContextHeadId: string | null
  selectedIds: readonly string[]
  activeRefFilter: readonly string[]
  hasWorkingTreeChanges: boolean
  workingTreeChangeCount: number
  statusCapped: boolean
  statusReadError: string | null
  showStashRows: boolean
  stashes: readonly GitGraphStash[]
  actionBusy: boolean
  onStash: () => void
  onApplyStash: (index: number) => void
  onSelect: (item: GitHistoryItem, event?: React.MouseEvent) => void
  onToggleRefFilter: (ref: GitHistoryItemRef) => void
  menuHandlers: GitGraphActionMenuHandlers
  onLoadMore: () => void
}): React.JSX.Element {
  return (
    <>
      <div
        className="grid shrink-0 gap-x-2 border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        style={{ gridTemplateColumns: gitGraphGridTemplate(viewSettings) }}
      >
        <span />
        <span>{translate('auto.components.git.graph.pane.description', 'Description')}</span>
        {viewSettings.showAuthor && (
          <span>{translate('auto.components.git.graph.pane.author', 'Author')}</span>
        )}
        {viewSettings.showDate && (
          <span>{translate('auto.components.git.graph.pane.date', 'Date')}</span>
        )}
        <span>{translate('auto.components.git.graph.pane.commit', 'Commit')}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek">
        {hasWorkingTreeChanges && (
          <GitGraphUncommittedRow
            changeCount={workingTreeChangeCount}
            statusCapped={statusCapped}
            busy={actionBusy}
            onStash={onStash}
          />
        )}
        {showStashRows &&
          stashes.map((stash) => (
            <GitGraphStashRow
              key={stash.oid}
              stash={stash}
              busy={actionBusy}
              onApply={() => onApplyStash(stash.index)}
            />
          ))}
        {status === 'loading' && !result && (
          <div className="p-4 text-xs text-muted-foreground">
            {translate('auto.components.git.graph.pane.loading', 'Loading graph...')}
          </div>
        )}
        {status === 'error' && !result && (
          <div className="p-4 text-xs text-destructive">{error}</div>
        )}
        {result &&
          result.items.length === 0 &&
          !hasWorkingTreeChanges &&
          !statusReadError &&
          (!showStashRows || stashes.length === 0) && (
            <div className="p-4 text-xs text-muted-foreground">
              {translate('auto.components.git.graph.pane.empty', 'No commits found.')}
            </div>
          )}
        {viewModels.map((viewModel) => (
          <ContextMenu key={viewModel.historyItem.id}>
            <ContextMenuTrigger asChild>
              <div>
                <GitGraphRow
                  viewModel={viewModel}
                  worktreeHeads={worktreeHeads}
                  actionContextHeadId={actionContextHeadId}
                  viewSettings={viewSettings}
                  selected={selectedIds.includes(viewModel.historyItem.id)}
                  activeRefFilter={activeRefFilter}
                  onSelect={onSelect}
                  onToggleRefFilter={onToggleRefFilter}
                />
              </div>
            </ContextMenuTrigger>
            <GitGraphActionMenu item={viewModel.historyItem} handlers={menuHandlers} />
          </ContextMenu>
        ))}
        {result?.hasMore && (
          <div className="p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={status === 'loading' || status === 'refreshing'}
              onClick={onLoadMore}
            >
              {translate('auto.components.git.graph.pane.loadMore', 'Load more commits')}
            </Button>
          </div>
        )}
        {status === 'error' && result && (
          <div className="p-2 text-[11px] text-destructive">{error}</div>
        )}
      </div>
    </>
  )
}
