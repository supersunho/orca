import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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
import { GitGraphTableHeader, type ColumnResizeKey } from './GitGraphTableHeader'
import { useMeasuredWidth } from '../right-sidebar/right-sidebar-measured-width'
import {
  GIT_GRAPH_AUTHOR_WIDTH,
  GIT_GRAPH_DATE_WIDTH,
  effectiveGitGraphViewSettings,
  type GitGraphViewSettings
} from './git-graph-view-settings'

type ColumnResize = { key: ColumnResizeKey; startX: number; startWidth: number; width: number }
const COLUMN_WIDTH_BOUNDS = {
  authorWidth: GIT_GRAPH_AUTHOR_WIDTH,
  dateWidth: GIT_GRAPH_DATE_WIDTH
}

type GitGraphTableEntry =
  | { kind: 'uncommitted' }
  | { kind: 'stash'; stash: GitGraphStash }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'row'; viewModel: GitHistoryItemViewModel; modelIndex: number }
  | { kind: 'load-more' }
  | { kind: 'trailing-error'; message: string }

export function GitGraphTable({
  status,
  result,
  error,
  viewSettings,
  viewModels,
  worktreeHeads,
  actionContextHeadId,
  currentBranch,
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
  onNavigate,
  onLoadMore
}: {
  status: 'idle' | 'loading' | 'refreshing' | 'error'
  result: GitHistoryResult | null
  error: string | null
  viewSettings: GitGraphViewSettings
  viewModels: readonly GitHistoryItemViewModel[]
  worktreeHeads: ReadonlyMap<string, readonly string[]>
  actionContextHeadId: string | null
  currentBranch: string | null
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
  onNavigate: (item: GitHistoryItem) => void
  onLoadMore: () => void
}): React.JSX.Element {
  const tableRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingFocusIndexRef = useRef<number | null>(null)
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

  const entries = useMemo<GitGraphTableEntry[]>(() => {
    const next: GitGraphTableEntry[] = []
    if (hasWorktreeStatus && hasWorkingTreeChanges) {
      next.push({ kind: 'uncommitted' })
    }
    if (showStashRows) {
      stashes.forEach((stash) => {
        next.push({ kind: 'stash', stash })
      })
    }
    if (status === 'loading' && !result) {
      next.push({ kind: 'loading' })
    }
    if (status === 'error' && !result) {
      next.push({ kind: 'error', message: error ?? '' })
    }
    if (
      result &&
      result.items.length === 0 &&
      !hasWorkingTreeChanges &&
      !statusReadError &&
      (!showStashRows || stashes.length === 0)
    ) {
      next.push({ kind: 'empty' })
    }
    viewModels.forEach((viewModel, modelIndex) => {
      next.push({ kind: 'row', viewModel, modelIndex })
    })
    if (result?.hasMore) {
      next.push({ kind: 'load-more' })
    }
    if (status === 'error' && result) {
      next.push({ kind: 'trailing-error', message: error ?? '' })
    }
    return next
  }, [
    error,
    hasWorkingTreeChanges,
    hasWorktreeStatus,
    result,
    showStashRows,
    stashes,
    status,
    statusReadError,
    viewModels
  ])

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const kind = entries[index]?.kind
      return kind === 'load-more' ? 44 : kind === 'uncommitted' || kind === 'stash' ? 29 : 32
    },
    overscan: 10,
    initialRect: { width: 0, height: 600 },
    getItemKey: (index) => {
      const entry = entries[index]
      if (!entry) {
        return index
      }
      if (entry.kind === 'row') {
        return `row:${entry.viewModel.historyItem.id}`
      }
      if (entry.kind === 'stash') {
        return `stash:${entry.stash.oid}`
      }
      return entry.kind
    }
  })

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
    const row = target.closest<HTMLElement>('[data-git-graph-model-index]')
    const current = Number(row?.dataset.gitGraphModelIndex)
    if (!Number.isInteger(current) || current < 0 || viewModels.length === 0) {
      return
    }
    event.preventDefault()
    const lastIndex = viewModels.length - 1
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? lastIndex
          : Math.min(lastIndex, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)))
    const nextEntryIndex = entries.findIndex(
      (entry) => entry.kind === 'row' && entry.modelIndex === nextIndex
    )
    if (nextEntryIndex !== -1) {
      virtualizer.scrollToIndex(nextEntryIndex, { align: 'auto' })
    }
    const nextRowSelector = `[data-git-graph-model-index="${nextIndex}"] [data-testid="git-graph-row"]`
    const mountedRow = tableRef.current?.querySelector<HTMLElement>(nextRowSelector)
    if (mountedRow) {
      mountedRow.focus()
      pendingFocusIndexRef.current = null
    } else {
      pendingFocusIndexRef.current = nextIndex
    }
    const destination = viewModels[nextIndex]
    if (destination) {
      onNavigate(destination.historyItem)
    }
  }

  useEffect(() => {
    const pendingIndex = pendingFocusIndexRef.current
    if (pendingIndex === null) {
      return
    }
    const row = tableRef.current?.querySelector<HTMLElement>(
      `[data-git-graph-model-index="${pendingIndex}"] [data-testid="git-graph-row"]`
    )
    if (row) {
      row.focus()
      pendingFocusIndexRef.current = null
    }
  })

  const renderEntry = (entry: GitGraphTableEntry): React.JSX.Element | null => {
    switch (entry.kind) {
      case 'uncommitted':
        return (
          <GitGraphUncommittedRow
            changeCount={workingTreeChangeCount}
            statusCapped={statusCapped}
            busy={actionBusy}
            onStash={onStash}
          />
        )
      case 'stash':
        return (
          <GitGraphStashRow
            stash={entry.stash}
            busy={actionBusy}
            onApply={() => onApplyStash(entry.stash.index)}
          />
        )
      case 'loading':
        return (
          <div className="p-4 text-xs text-muted-foreground">
            {translate('auto.components.git.graph.pane.loading', 'Loading graph...')}
          </div>
        )
      case 'error':
        return <div className="p-4 text-xs text-destructive">{entry.message}</div>
      case 'empty':
        return (
          <div className="p-4 text-xs text-muted-foreground">
            {translate('auto.components.git.graph.pane.empty', 'No commits found.')}
          </div>
        )
      case 'row':
        return (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div data-git-graph-model-index={entry.modelIndex}>
                <GitGraphRow
                  viewModel={entry.viewModel}
                  worktreeHeads={worktreeHeads}
                  actionContextHeadId={actionContextHeadId}
                  viewSettings={previewSettings}
                  selected={selectedIds.includes(entry.viewModel.historyItem.id)}
                  activeRefFilter={activeRefFilter}
                  onSelect={onSelect}
                  onToggleRefFilter={onToggleRefFilter}
                />
              </div>
            </ContextMenuTrigger>
            <GitGraphActionMenu
              item={entry.viewModel.historyItem}
              handlers={menuHandlers}
              currentBranch={currentBranch}
            />
          </ContextMenu>
        )
      case 'load-more':
        return (
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
        )
      case 'trailing-error':
        return <div className="p-2 text-[11px] text-destructive">{entry.message}</div>
    }
  }

  return (
    <div
      ref={setTableNode}
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={handleRowNavigation}
    >
      <GitGraphTableHeader
        settings={previewSettings}
        onStartResize={startResize}
        onMoveResize={moveResize}
        onFinishResize={finishResize}
        onCancelResize={() => setResize(null)}
        onResizeWithKeyboard={resizeWithKeyboard}
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto scrollbar-sleek">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const entry = entries[virtualRow.index]
            if (!entry) {
              return null
            }
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {renderEntry(entry)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
