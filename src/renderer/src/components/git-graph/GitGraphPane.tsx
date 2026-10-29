import React, { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useWorktreeById } from '@/store/selectors'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { useWorktreeGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import { useGitHistoryCommitActions } from '../right-sidebar/source-control/sync/use-git-history-commit-actions'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { GitGraphAction } from '../../../../shared/git-graph-actions'
import { isFolderGitGraphWorkspace } from './git-graph-folder-workspace'
import { shortRefName } from './git-graph-row-refs'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { GitGraphRow } from './GitGraphRow'
import { GitGraphStashRow, GitGraphUncommittedRow } from './GitGraphAuxRows'
import { GitGraphActionMenu } from './GitGraphActionMenu'
import { GitGraphActionDialog, type GitGraphDialogRequest } from './GitGraphActionDialog'
import { GitGraphAuxRefsDialog } from './GitGraphAuxRefsDialog'
import { GitGraphRemoteDialog } from './GitGraphRemoteDialog'
import { GitGraphSyncDialog } from './GitGraphSyncDialog'
import { GitGraphConflictBanner } from './GitGraphConflictBanner'
import { GitGraphStatusErrorBanner } from './GitGraphStatusErrorBanner'
import { GitGraphOldRuntimeBanner, isOldRuntimeHistory } from './GitGraphOldRuntimeBanner'
import { GitGraphFolderEmpty } from './GitGraphFolderEmpty'
import { GitGraphDetailsPanel } from './GitGraphDetailsPanel'
import { GitGraphToolbar } from './GitGraphToolbar'
import { useGitGraphActions } from './useGitGraphActions'
import { useGitGraphAuxRefs } from './useGitGraphAuxRefs'
import { useGitGraphHistory } from './useGitGraphHistory'
import { useGitGraphWorktreeStatus } from './useGitGraphWorktreeStatus'
import { useGitGraphCommitSelection } from './useGitGraphCommitSelection'
import { useGitGraphViewModels } from './useGitGraphViewModels'
import { useGitGraphRangeActions } from './useGitGraphRangeActions'
import { useGitGraphMenuHandlers } from './useGitGraphMenuHandlers'
import { useGitGraphSync } from './useGitGraphSync'

export default function GitGraphPane({
  worktreeId,
  executionHostId
}: {
  worktreeId: string
  executionHostId?: ExecutionHostId
}): React.JSX.Element {
  const worktree = useWorktreeById(worktreeId, executionHostId)
  const ownerTarget = useWorktreeGitOwnerTarget(worktreeId)
  const isFolderWorkspace = isFolderGitGraphWorkspace(worktree, worktreeId)
  const gitWorktreePath = isFolderWorkspace ? null : (worktree?.path ?? null)
  const gitOwnerTarget = isFolderWorkspace ? null : ownerTarget
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const worktrees = useMemo(() => Object.values(worktreesByRepo ?? {}).flat(), [worktreesByRepo])
  const {
    result,
    status,
    error,
    searchDraft,
    setSearchDraft,
    refFilter,
    setRefFilter,
    refresh,
    loadMore
  } = useGitGraphHistory({
    worktreeId,
    worktreePath: gitWorktreePath,
    ownerTarget: gitOwnerTarget
  })
  const auxRefs = useGitGraphAuxRefs({
    worktreeId,
    worktreePath: gitWorktreePath,
    ownerTarget: gitOwnerTarget,
    refreshKey: result
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dialogRequest, setDialogRequest] = useState<GitGraphDialogRequest | null>(null)
  const [auxDialog, setAuxDialog] = useState<'stashes' | 'backups' | null>(null)
  const [remoteOpen, setRemoteOpen] = useState(false)
  const [pendingSync, setPendingSync] = useState<'pull' | 'push' | null>(null)
  const [showStashRows, setShowStashRows] = useState(true)
  const openCommitDiff = useAppStore((state) => state.openCommitDiff)
  const openCommitAllDiffs = useAppStore((state) => state.openCommitAllDiffs)
  const openConflictReview = useAppStore((state) => state.openConflictReview)

  const { loadCommitFiles, openHistoryCommitDiff, openCommitFile } = useGitHistoryCommitActions({
    activeWorktreeId: worktreeId,
    worktreePath: gitWorktreePath,
    activeRepoTarget: gitOwnerTarget,
    resolveSplitTargetGroupId: () => undefined
  })

  const {
    busy: actionBusy,
    conflict,
    runAction,
    clearConflict
  } = useGitGraphActions({
    worktreeId,
    worktreePath: gitWorktreePath,
    ownerTarget: gitOwnerTarget,
    onCompleted: () => {
      refresh()
      setSelectedIds([])
    }
  })

  const {
    worktreeStatus,
    conflictEntries,
    hasWorkingTreeChanges,
    workingTreeChangeCount,
    statusCapped,
    statusReadError
  } = useGitGraphWorktreeStatus({
    worktreeId,
    worktreePath: gitWorktreePath,
    ownerTarget: gitOwnerTarget,
    refreshKey: result,
    conflict
  })
  const { singleSelected, files, filesStatus, filesError, rangeCompare } =
    useGitGraphCommitSelection({
      selectedIds,
      result,
      loadCommitFiles,
      worktreeId,
      worktreePath: gitWorktreePath,
      ownerTarget: gitOwnerTarget
    })

  const { worktreeHeads, viewModels } = useGitGraphViewModels({ worktrees, result })

  const toggleRefFilter = useCallback(
    (ref: GitHistoryItemRef) => {
      setRefFilter((previous) =>
        previous.includes(ref.id)
          ? previous.filter((candidate) => candidate !== ref.id)
          : [...previous, ref.id]
      )
    },
    [setRefFilter]
  )

  const selectCommit = useCallback((item: GitHistoryItem, event?: React.MouseEvent) => {
    const additive = event?.metaKey === true || event?.ctrlKey === true
    setSelectedIds((previous) => {
      if (!additive) {
        return previous.length === 1 && previous[0] === item.id ? [] : [item.id]
      }
      if (previous.includes(item.id)) {
        return previous.filter((id) => id !== item.id)
      }
      return previous.length >= 2 ? [previous[1], item.id] : [...previous, item.id]
    })
  }, [])

  const { openRangeFile, openRangeDiff } = useGitGraphRangeActions({
    rangeCompare,
    worktreeId,
    worktreePath: gitWorktreePath,
    openCommitDiff,
    openCommitAllDiffs
  })

  const menuHandlers = useGitGraphMenuHandlers({ runAction, setDialogRequest, setSelectedIds })

  const { syncBusy, runSync } = useGitGraphSync({
    worktreeId,
    worktreePath: gitWorktreePath,
    ownerTarget: gitOwnerTarget,
    onCompleted: refresh
  })

  const confirmDialog = (action: GitGraphAction): void => {
    setDialogRequest(null)
    void runAction(action)
  }

  const requestStash = (): void => {
    setDialogRequest({
      kind: 'confirm',
      title: translate('auto.components.git.graph.sync.stash', 'Stash'),
      description: translate(
        'auto.components.git.graph.dialog.stashDescription',
        'Stash all working tree changes, including untracked files.'
      ),
      action: { kind: 'stashCreate', includeUntracked: true }
    })
  }

  const branchLabel =
    shortRefName(worktree?.branch ?? '') ||
    shortRefName(result?.currentRef?.name ?? '') ||
    worktree?.path ||
    ''

  if (isFolderWorkspace) {
    return <GitGraphFolderEmpty />
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <GitGraphToolbar
        branchLabel={branchLabel}
        count={result?.items.length ?? 0}
        hasMore={result?.hasMore ?? false}
        searchDraft={searchDraft}
        onSearchChange={setSearchDraft}
        loading={status === 'loading' || status === 'refreshing'}
        onRefresh={refresh}
        syncBusy={syncBusy}
        hasWorkingTreeChanges={hasWorkingTreeChanges}
        actionBusy={actionBusy}
        stashCount={auxRefs.stashes.length}
        stashesVisible={showStashRows}
        onToggleStashes={() => setShowStashRows((visible) => !visible)}
        backupCount={auxRefs.backups.length}
        onFetch={() => void runSync('fetch')}
        onPull={() => setPendingSync('pull')}
        onPush={() => setPendingSync('push')}
        onStashes={() => setAuxDialog('stashes')}
        onBackups={() => setAuxDialog('backups')}
        onRemotes={() => setRemoteOpen(true)}
        onStash={requestStash}
      />

      {refFilter.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-3 py-1">
          {refFilter.map((ref) => (
            <button
              key={ref}
              type="button"
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
              onClick={() => setRefFilter((previous) => previous.filter((item) => item !== ref))}
            >
              {shortRefName(ref)}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            className="px-1 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setRefFilter([])}
          >
            {translate('auto.components.git.graph.pane.clearFilters', 'Clear filters')}
          </button>
        </div>
      )}

      {isOldRuntimeHistory(result) && <GitGraphOldRuntimeBanner />}

      {statusReadError && <GitGraphStatusErrorBanner message={statusReadError} />}

      {conflict && (
        <GitGraphConflictBanner
          conflict={conflict}
          reviewCount={conflictEntries.length}
          busy={actionBusy}
          onReview={() => {
            if (worktree?.path) {
              openConflictReview(worktreeId, worktree.path, conflictEntries, 'live-summary')
            }
          }}
          onContinue={() => void runAction({ kind: 'continueOperation' })}
          onSkip={() => void runAction({ kind: 'skipOperation' })}
          onAbort={() => void runAction({ kind: 'abortOperation' })}
          onDismiss={clearConflict}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="grid shrink-0 grid-cols-[76px_minmax(0,1fr)_132px_96px_76px] gap-x-2 border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span />
            <span>{translate('auto.components.git.graph.pane.description', 'Description')}</span>
            <span>{translate('auto.components.git.graph.pane.author', 'Author')}</span>
            <span>{translate('auto.components.git.graph.pane.date', 'Date')}</span>
            <span>{translate('auto.components.git.graph.pane.commit', 'Commit')}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek">
            {worktreeStatus && hasWorkingTreeChanges && (
              <GitGraphUncommittedRow
                changeCount={workingTreeChangeCount}
                statusCapped={statusCapped}
                busy={actionBusy}
                onStash={requestStash}
              />
            )}
            {showStashRows &&
              auxRefs.stashes.map((stash) => (
                <GitGraphStashRow
                  key={stash.oid}
                  stash={stash}
                  busy={actionBusy}
                  onApply={() =>
                    void runAction({
                      kind: 'stashApply',
                      index: stash.index,
                      reinstateIndex: false
                    })
                  }
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
              (!showStashRows || auxRefs.stashes.length === 0) && (
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
                      actionContextHeadId={worktree?.head ?? null}
                      selected={selectedIds.includes(viewModel.historyItem.id)}
                      activeRefFilter={refFilter}
                      onSelect={selectCommit}
                      onToggleRefFilter={toggleRefFilter}
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
                  onClick={() => void loadMore()}
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

        <GitGraphDetailsPanel
          selected={singleSelected}
          files={files}
          filesStatus={filesStatus}
          filesError={filesError}
          rangeCompare={rangeCompare}
          onClose={() => setSelectedIds([])}
          onOpenDiff={() => {
            if (singleSelected) {
              void openHistoryCommitDiff(singleSelected)
            }
          }}
          onOpenFile={(entry) => {
            if (singleSelected) {
              openCommitFile(singleSelected, entry)
            }
          }}
          onOpenCompareDiff={openRangeDiff}
          onOpenCompareFile={openRangeFile}
        />
      </div>

      {auxDialog && (
        <GitGraphAuxRefsDialog
          mode={auxDialog}
          refs={auxRefs}
          busy={actionBusy}
          onClose={() => setAuxDialog(null)}
          onAction={(action) => {
            setAuxDialog(null)
            void runAction(action)
          }}
        />
      )}

      {remoteOpen && (
        <GitGraphRemoteDialog
          busy={actionBusy}
          onClose={() => setRemoteOpen(false)}
          onAction={(action) => {
            setRemoteOpen(false)
            void runAction(action)
          }}
        />
      )}

      {pendingSync && (
        <GitGraphSyncDialog
          kind={pendingSync}
          onCancel={() => setPendingSync(null)}
          onConfirm={() => {
            const kind = pendingSync
            setPendingSync(null)
            void runSync(kind)
          }}
        />
      )}

      {dialogRequest && (
        <GitGraphActionDialog
          request={dialogRequest}
          busy={actionBusy}
          onCancel={() => setDialogRequest(null)}
          onConfirm={confirmDialog}
        />
      )}
    </div>
  )
}
