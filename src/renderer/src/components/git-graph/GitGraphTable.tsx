import React, { useCallback, useRef, useState } from 'react'
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
import { useMeasuredWidth } from '../right-sidebar/right-sidebar-measured-width'
import {
  GIT_GRAPH_AUTHOR_WIDTH,
  GIT_GRAPH_DATE_WIDTH,
  effectiveGitGraphViewSettings,
  gitGraphGridTemplate,
  type GitGraphViewSettings
} from './git-graph-view-settings'

type ColumnResizeKey = 'authorWidth' | 'dateWidth'
type ColumnResize = { key: ColumnResizeKey; startX: number; startWidth: number; width: number }
const COLUMN_WIDTH_BOUNDS = {
  authorWidth: GIT_GRAPH_AUTHOR_WIDTH,
  dateWidth: GIT_GRAPH_DATE_WIDTH
}

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
  hasWorktreeStatus,
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
  onColumnResize,
  onClearSelection,
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
  hasWorktreeStatus: boolean
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
  onColumnResize: (key: ColumnResizeKey, width: number) => void
  onClearSelection: () => void
  onLoadMore: () => void
}): React.JSX.Element {
  const tableRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState<number | null>(null)
  const [resize, setResize] = useState<ColumnResize | null>(null)
  const measuredRef = useMeasuredWidth(setTableWidth)
  const setTableNode = useCallback(
    (node: HTMLDivElement | null) => {
      measuredRef(node)
      tableRef.current = node
    },
    [measuredRef]
  )
  const effectiveSettings = effectiveGitGraphViewSettings(viewSettings, tableWidth)
  const previewSettings = resize
    ? { ...effectiveSettings, [resize.key]: resize.width }
    : effectiveSettings

  const startResize = (key: ColumnResizeKey, event: React.PointerEvent<HTMLSpanElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setResize({
      key,
      startX: event.clientX,
      startWidth: previewSettings[key],
      width: previewSettings[key]
    })
  }

  const moveResize = (event: React.PointerEvent<HTMLSpanElement>): void => {
    if (!resize) {
      return
    }
    const bounds = COLUMN_WIDTH_BOUNDS[resize.key]
    const width = Math.min(
      bounds.max,
      Math.max(bounds.min, resize.startWidth + event.clientX - resize.startX)
    )
    setResize((previous) => (previous ? { ...previous, width } : previous))
  }

  const finishResize = (): void => {
    if (resize) {
      onColumnResize(resize.key, resize.width)
      setResize(null)
    }
  }

  const resizeWithKeyboard = (
    key: ColumnResizeKey,
    event: React.KeyboardEvent<HTMLSpanElement>
  ): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }
    event.preventDefault()
    const bounds = COLUMN_WIDTH_BOUNDS[key]
    const delta = event.key === 'ArrowLeft' ? -8 : 8
    onColumnResize(key, Math.min(bounds.max, Math.max(bounds.min, previewSettings[key] + delta)))
  }

  const handleRowNavigation = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.closest('[data-testid="git-graph-row"]')) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onClearSelection()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return
    }
    const rows = Array.from(
      tableRef.current?.querySelectorAll<HTMLElement>('[data-testid="git-graph-row"]') ?? []
    )
    const current = rows.findIndex((row) => row === target || row.contains(target))
    if (current === -1) {
      return
    }
    event.preventDefault()
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : Math.min(rows.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)))
    rows[nextIndex]?.focus()
  }

  return (
    <div
      ref={setTableNode}
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={handleRowNavigation}
    >
      <div
        className="grid shrink-0 gap-x-2 border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        style={{ gridTemplateColumns: gitGraphGridTemplate(previewSettings) }}
      >
        <span />
        <span>{translate('auto.components.git.graph.pane.description', 'Description')}</span>
        {previewSettings.showAuthor && (
          <span className="relative flex min-w-0 items-center">
            {translate('auto.components.git.graph.pane.author', 'Author')}
            <span
              role="separator"
              aria-orientation="vertical"
              aria-label={translate(
                'auto.components.git.graph.pane.resizeAuthor',
                'Resize author column'
              )}
              aria-valuemin={GIT_GRAPH_AUTHOR_WIDTH.min}
              aria-valuemax={GIT_GRAPH_AUTHOR_WIDTH.max}
              aria-valuenow={previewSettings.authorWidth}
              tabIndex={0}
              className="absolute inset-y-0 -right-1 w-2 cursor-col-resize touch-none hover:bg-border"
              onPointerDown={(event) => startResize('authorWidth', event)}
              onPointerMove={moveResize}
              onPointerUp={finishResize}
              onPointerCancel={() => setResize(null)}
              onKeyDown={(event) => resizeWithKeyboard('authorWidth', event)}
            />
          </span>
        )}
        {previewSettings.showDate && (
          <span className="relative flex min-w-0 items-center">
            {translate('auto.components.git.graph.pane.date', 'Date')}
            <span
              role="separator"
              aria-orientation="vertical"
              aria-label={translate(
                'auto.components.git.graph.pane.resizeDate',
                'Resize date column'
              )}
              aria-valuemin={GIT_GRAPH_DATE_WIDTH.min}
              aria-valuemax={GIT_GRAPH_DATE_WIDTH.max}
              aria-valuenow={previewSettings.dateWidth}
              tabIndex={0}
              className="absolute inset-y-0 -right-1 w-2 cursor-col-resize touch-none hover:bg-border"
              onPointerDown={(event) => startResize('dateWidth', event)}
              onPointerMove={moveResize}
              onPointerUp={finishResize}
              onPointerCancel={() => setResize(null)}
              onKeyDown={(event) => resizeWithKeyboard('dateWidth', event)}
            />
          </span>
        )}
        <span>{translate('auto.components.git.graph.pane.commit', 'Commit')}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek">
        {hasWorktreeStatus && hasWorkingTreeChanges && (
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
                  viewSettings={previewSettings}
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
    </div>
  )
}
