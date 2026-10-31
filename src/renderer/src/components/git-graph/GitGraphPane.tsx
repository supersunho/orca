import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useWorktreeById } from '@/store/selectors'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { useWorktreeGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import { useGitHistoryCommitActions } from '../right-sidebar/source-control/sync/use-git-history-commit-actions'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { GitGraphAction } from '../../../../shared/git-graph-actions'
import { findOccupiedWorktree } from './git-graph-occupied-worktree'
import { isFolderGitGraphWorkspace } from './git-graph-folder-workspace'
import {
  readGitGraphViewSettings,
  writeGitGraphViewSettings,
  type GitGraphViewSettings
} from './git-graph-view-settings'
import { shortRefName } from './git-graph-row-refs'
import { translate } from '@/i18n/i18n'
import { GitGraphTable } from './GitGraphTable'
import {
  GitGraphActionDialog,
  gitGraphDialogRequestKey,
  type GitGraphDialogRequest
} from './GitGraphActionDialog'
import { GitGraphAuxRefsDialog } from './GitGraphAuxRefsDialog'
import { GitGraphRemoteDialog } from './GitGraphRemoteDialog'
import { GitGraphSyncDialog } from './GitGraphSyncDialog'
import { GitGraphConflictBanner } from './GitGraphConflictBanner'
import { GitGraphStatusErrorBanner } from './GitGraphStatusErrorBanner'
import { GitGraphOldRuntimeBanner, isOldRuntimeHistory } from './GitGraphOldRuntimeBanner'
import { GitGraphFolderEmpty } from './GitGraphFolderEmpty'
import { GitGraphDetailsPanel } from './GitGraphDetailsPanel'
import { GitGraphBranchFilterChips } from './GitGraphBranchFilterChips'
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
  const [showRemoteBranches, setShowRemoteBranches] = useState(false)
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
    showRemoteBranches,
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
  const [viewSettings, setViewSettings] = useState(readGitGraphViewSettings)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dialogRequest, setDialogRequest] = useState<GitGraphDialogRequest | null>(null)
  const [auxDialog, setAuxDialog] = useState<'stashes' | 'backups' | null>(null)
  const [remoteOpen, setRemoteOpen] = useState(false)
  const [pendingSync, setPendingSync] = useState<'pull' | 'push' | 'forcePush' | null>(null)
  const [showStashRows, setShowStashRows] = useState(true)
  const setActiveWorktree = useAppStore((state) => state.setActiveWorktree)
  const openCommitDiff = useAppStore((state) => state.openCommitDiff)
  const openCommitAllDiffs = useAppStore((state) => state.openCommitAllDiffs)
  const openConflictReview = useAppStore((state) => state.openConflictReview)

  const { loadCommitFiles, openHistoryCommitDiff, openCommitFile } = useGitHistoryCommitActions({
    activeWorktreeId: worktreeId,
    worktreePath: gitWorktreePath,
    activeRepoTarget: gitOwnerTarget,
    resolveSplitTargetGroupId: () => undefined
  })

  const redirectOccupiedBranch = useCallback(
    (occupiedPath: string) => {
      if (!worktree) {
        return null
      }
      const target = findOccupiedWorktree(worktrees, occupiedPath, worktree)
      return target ? () => setActiveWorktree(target.id) : null
    },
    [setActiveWorktree, worktree, worktrees]
  )

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
    },
    onOccupiedBranch: redirectOccupiedBranch
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

  const graphBranches = useMemo(() => {
    const seen = new Map<string, { name: string; id: string }>()
    const wanted = showRemoteBranches ? ['branches', 'remote branches'] : ['branches']
    for (const viewModel of viewModels) {
      for (const ref of viewModel.historyItem.references ?? []) {
        if (!ref.category || !wanted.includes(ref.category) || seen.has(ref.id)) {
          continue
        }
        seen.set(ref.id, { name: ref.name, id: ref.id })
      }
    }
    return [...seen.values()]
  }, [viewModels, showRemoteBranches])

  const toggleRefFilter = useCallback(
    (ref: GitHistoryItemRef | string) => {
      const id = typeof ref === 'string' ? ref : ref.id
      setRefFilter((previous) =>
        previous.includes(id) ? previous.filter((candidate) => candidate !== id) : [...previous, id]
      )
    },
    [setRefFilter]
  )

  useEffect(() => {
    writeGitGraphViewSettings(viewSettings)
  }, [viewSettings])

  const toggleViewSetting = useCallback((key: keyof GitGraphViewSettings) => {
    setViewSettings((previous) => ({ ...previous, [key]: !previous[key] }))
  }, [])

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

  const menuHandlers = useGitGraphMenuHandlers({ setDialogRequest, setSelectedIds })

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
        viewSettings={viewSettings}
        onToggleViewSetting={toggleViewSetting}
        onFetch={() => void runSync('fetch')}
        onPull={() => setPendingSync('pull')}
        onPush={() => setPendingSync('push')}
        onForcePush={() => setPendingSync('forcePush')}
        onStashes={() => setAuxDialog('stashes')}
        onBackups={() => setAuxDialog('backups')}
        onRemotes={() => setRemoteOpen(true)}
        onStash={requestStash}
        branches={graphBranches}
        activeBranchFilters={refFilter}
        onToggleBranchFilter={(refId) => toggleRefFilter(refId)}
        onClearBranchFilters={() => setRefFilter([])}
        showRemoteBranches={showRemoteBranches}
        onShowRemoteBranchesChange={(visible) => {
          setShowRemoteBranches(visible)
          if (!visible) {
            setRefFilter((previous) => previous.filter((ref) => !ref.startsWith('refs/remotes/')))
          }
        }}
      />

      <GitGraphBranchFilterChips
        refFilter={refFilter}
        onRemove={(ref) => setRefFilter((previous) => previous.filter((item) => item !== ref))}
        onClear={() => setRefFilter([])}
      />

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
          <GitGraphTable
            status={status}
            result={result}
            error={error}
            viewSettings={viewSettings}
            viewModels={viewModels}
            worktreeHeads={worktreeHeads}
            actionContextHeadId={worktree?.head ?? null}
            currentBranch={shortRefName(worktree?.branch ?? '') || null}
            selectedIds={selectedIds}
            activeRefFilter={refFilter}
            hasWorktreeStatus={worktreeStatus !== null}
            hasWorkingTreeChanges={hasWorkingTreeChanges}
            workingTreeChangeCount={workingTreeChangeCount}
            statusCapped={statusCapped}
            statusReadError={statusReadError}
            showStashRows={showStashRows}
            stashes={auxRefs.stashes}
            actionBusy={actionBusy}
            onStash={requestStash}
            onApplyStash={(index) =>
              void runAction({ kind: 'stashApply', index, reinstateIndex: false })
            }
            onSelect={selectCommit}
            onToggleRefFilter={toggleRefFilter}
            menuHandlers={menuHandlers}
            onColumnResize={(key, width) =>
              setViewSettings((previous) => ({ ...previous, [key]: width }))
            }
            onClearSelection={() => setSelectedIds([])}
            onNavigate={(item) => setSelectedIds([item.id])}
            onLoadMore={() => void loadMore()}
          />
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
          key={gitGraphDialogRequestKey(dialogRequest)}
          request={dialogRequest}
          busy={actionBusy}
          onCancel={() => setDialogRequest(null)}
          onConfirm={confirmDialog}
        />
      )}
    </div>
  )
}
