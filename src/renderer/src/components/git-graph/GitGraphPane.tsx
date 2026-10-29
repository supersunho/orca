/* eslint-disable max-lines -- Why: the pane keeps query, selection, action, and dialog orchestration together so cross-surface invariants stay visible; presentation lives in extracted components. */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useWorktreeById } from '@/store/selectors'
import { getConnectionId } from '@/lib/connection-context'
import {
  requireGitOwnerTarget,
  useWorktreeGitOwnerTarget
} from '../right-sidebar/worktree-git-owner-target'
import { getRuntimeGitStatus } from '@/runtime/runtime-git-status-client'
import { getRuntimeGitCommitRangeCompare } from '@/runtime/runtime-git-diff-client'
import { fetchRuntimeGit, pullRuntimeGit, pushRuntimeGit } from '@/runtime/runtime-git-sync-client'
import { toast } from 'sonner'
import { detectLanguage } from '@/lib/language-detect'
import { useGitHistoryCommitActions } from '../right-sidebar/source-control/sync/use-git-history-commit-actions'
import {
  buildDefaultGitHistoryColorMap,
  buildGitHistoryViewModels
} from '../../../../shared/git-history-graph'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'
import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { ConflictReviewEntry } from '../../../../shared/editor-tab-view-types'
import type { GitGraphAction } from '../../../../shared/git-graph-actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { GitGraphRow } from './GitGraphRow'
import { GitGraphActionMenu } from './GitGraphActionMenu'
import { GitGraphActionDialog, type GitGraphDialogRequest } from './GitGraphActionDialog'
import { GitGraphAuxRefsDialog } from './GitGraphAuxRefsDialog'
import { GitGraphRemoteDialog } from './GitGraphRemoteDialog'
import { GitGraphConflictBanner } from './GitGraphConflictBanner'
import { GitGraphDetailsPanel, type GitGraphRangeCompareState } from './GitGraphDetailsPanel'
import { GitGraphToolbar } from './GitGraphToolbar'
import { useGitGraphActions } from './useGitGraphActions'
import { useGitGraphAuxRefs } from './useGitGraphAuxRefs'
import { useGitGraphHistory } from './useGitGraphHistory'

function shortRefName(ref: string): string {
  return ref.replace(/^refs\/(?:heads|remotes|tags)\//, '')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function GitGraphPane({
  worktreeId,
  executionHostId
}: {
  worktreeId: string
  executionHostId?: ExecutionHostId
}): React.JSX.Element {
  const worktree = useWorktreeById(worktreeId, executionHostId)
  const ownerTarget = useWorktreeGitOwnerTarget(worktreeId)
  const worktreesByRepo = useAppStore((state) => state.worktreesByRepo)
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
    worktreePath: worktree?.path ?? null,
    ownerTarget
  })
  const auxRefs = useGitGraphAuxRefs({
    worktreeId,
    worktreePath: worktree?.path ?? null,
    ownerTarget,
    refreshKey: result
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [files, setFiles] = useState<GitBranchChangeEntry[]>([])
  const [filesStatus, setFilesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [filesError, setFilesError] = useState<string | null>(null)
  const [rangeCompare, setRangeCompare] = useState<GitGraphRangeCompareState | null>(null)
  const [dialogRequest, setDialogRequest] = useState<GitGraphDialogRequest | null>(null)
  const [auxDialog, setAuxDialog] = useState<'stashes' | 'backups' | null>(null)
  const [remoteOpen, setRemoteOpen] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [pendingSync, setPendingSync] = useState<'pull' | 'push' | null>(null)
  const [hasWorkingTreeChanges, setHasWorkingTreeChanges] = useState(false)
  const [conflictEntries, setConflictEntries] = useState<ConflictReviewEntry[]>([])
  const openCommitDiff = useAppStore((state) => state.openCommitDiff)
  const openCommitAllDiffs = useAppStore((state) => state.openCommitAllDiffs)
  const openConflictReview = useAppStore((state) => state.openConflictReview)

  const { loadCommitFiles, openHistoryCommitDiff, openCommitFile } = useGitHistoryCommitActions({
    activeWorktreeId: worktreeId,
    worktreePath: worktree?.path ?? null,
    activeRepoTarget: ownerTarget,
    resolveSplitTargetGroupId: () => undefined
  })

  const {
    busy: actionBusy,
    conflict,
    runAction,
    clearConflict
  } = useGitGraphActions({
    worktreeId,
    worktreePath: worktree?.path ?? null,
    ownerTarget,
    onCompleted: () => {
      refresh()
      setSelectedIds([])
    }
  })

  useEffect(() => {
    if (!conflict || !worktree?.path || !ownerTarget) {
      setConflictEntries([])
      return
    }
    let cancelled = false
    void getRuntimeGitStatus(
      {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath: worktree.path,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      { admissionTier: 'background' }
    )
      .then((next) => {
        if (!cancelled) {
          setConflictEntries(
            next.entries.flatMap((entry) =>
              entry.conflictKind ? [{ path: entry.path, conflictKind: entry.conflictKind }] : []
            )
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConflictEntries([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [conflict, worktree?.path, ownerTarget, worktreeId])

  useEffect(() => {
    if (!worktree?.path || !ownerTarget) {
      setHasWorkingTreeChanges(false)
      return
    }
    let cancelled = false
    void getRuntimeGitStatus(
      {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath: worktree.path,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      { admissionTier: 'background' }
    )
      .then((next) => {
        if (!cancelled) {
          setHasWorkingTreeChanges(next.entries.length > 0 || (next.statusLength ?? 0) > 0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasWorkingTreeChanges(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [worktree?.path, ownerTarget, worktreeId, result])

  const singleSelected =
    selectedIds.length === 1
      ? (result?.items.find((item) => item.id === selectedIds[0]) ?? null)
      : null

  useEffect(() => {
    if (!singleSelected) {
      setFiles([])
      setFilesStatus('idle')
      setFilesError(null)
      return
    }
    let cancelled = false
    setFilesStatus('loading')
    setFilesError(null)
    void loadCommitFiles(singleSelected)
      .then((entries) => {
        if (!cancelled) {
          setFiles(entries)
          setFilesStatus('ready')
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setFilesStatus('error')
          setFilesError(errorMessage(nextError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [loadCommitFiles, singleSelected])

  useEffect(() => {
    if (selectedIds.length !== 2 || !worktree?.path || !ownerTarget) {
      setRangeCompare(null)
      return
    }
    const base = result?.items.find((item) => item.id === selectedIds[0])
    const head = result?.items.find((item) => item.id === selectedIds[1])
    if (!base || !head) {
      setRangeCompare(null)
      return
    }
    let cancelled = false
    setRangeCompare({
      base,
      head,
      result: {
        summary: { baseOid: base.id, headOid: head.id, changedFiles: 0, status: 'ready' },
        entries: []
      },
      status: 'loading'
    })
    void getRuntimeGitCommitRangeCompare(
      {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath: worktree.path,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      base.id,
      head.id
    )
      .then((next) => {
        if (!cancelled) {
          setRangeCompare({
            base,
            head,
            result: next,
            status: next.summary.status === 'ready' ? 'ready' : 'error'
          })
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setRangeCompare({
            base,
            head,
            result: {
              summary: {
                baseOid: base.id,
                headOid: head.id,
                changedFiles: 0,
                status: 'error',
                errorMessage: errorMessage(nextError)
              },
              entries: []
            },
            status: 'error'
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedIds, result, worktree?.path, ownerTarget, worktreeId])

  const worktreeHeads = useMemo(() => {
    const heads = new Map<string, string[]>()
    for (const candidate of worktrees) {
      if (!candidate.head) {
        continue
      }
      const label = candidate.branch || candidate.path
      const existing = heads.get(candidate.head)
      if (existing) {
        existing.push(label)
      } else {
        heads.set(candidate.head, [label])
      }
    }
    return heads
  }, [worktrees])

  const viewModels = useMemo(
    () =>
      result
        ? buildGitHistoryViewModels(
            result.items,
            buildDefaultGitHistoryColorMap(result),
            result.currentRef,
            result.remoteRef,
            result.baseRef,
            false,
            false,
            result.mergeBase
          )
        : [],
    [result]
  )

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

  const openRangeFile = useCallback(
    (entry: GitBranchChangeEntry) => {
      if (!rangeCompare || !worktree?.path) {
        return
      }
      openCommitDiff(
        worktreeId,
        worktree.path,
        entry,
        {
          commitOid: rangeCompare.head.id,
          parentOid: rangeCompare.base.id,
          compareRef: rangeCompare.head.id.slice(0, 7),
          baseRef: rangeCompare.base.id.slice(0, 7)
        },
        detectLanguage(entry.path)
      )
    },
    [openCommitDiff, rangeCompare, worktree?.path, worktreeId]
  )

  const openRangeDiff = useCallback(() => {
    if (!rangeCompare || !worktree?.path) {
      return
    }
    const baseRef = rangeCompare.base.id.slice(0, 7)
    const compareRef = rangeCompare.head.id.slice(0, 7)
    openCommitAllDiffs(
      worktreeId,
      worktree.path,
      {
        commitOid: rangeCompare.head.id,
        parentOid: rangeCompare.base.id,
        compareRef,
        baseRef,
        changedFiles: rangeCompare.result.entries.length,
        status: 'ready'
      },
      rangeCompare.result.entries,
      `${baseRef}..${compareRef}`
    )
  }, [openCommitAllDiffs, rangeCompare, worktree?.path, worktreeId])

  const menuHandlers = {
    onCheckoutRef: (ref: string) => void runAction({ kind: 'checkout', branch: ref }),
    onCreateBranch: (startPoint: string) =>
      setDialogRequest({ kind: 'createBranch', startPoint, name: '', checkout: true }),
    onRenameBranch: (name: string) => setDialogRequest({ kind: 'renameBranch', name }),
    onDeleteBranch: (name: string) =>
      setDialogRequest({ kind: 'deleteBranch', name, force: false }),
    onMerge: (target: string) =>
      setDialogRequest({
        kind: 'merge',
        target,
        noFastForward: true,
        squash: false,
        noCommit: false
      }),
    onRebase: (target: string) =>
      setDialogRequest({ kind: 'rebase', onto: target, ignoreDate: true }),
    onCherryPick: (commit: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.cherryPick', 'Cherry-pick commit'),
        description: commit.slice(0, 7),
        action: { kind: 'cherryPick', commit, noCommit: false, recordOrigin: false }
      }),
    onRevert: (commit: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.revert', 'Revert commit'),
        description: commit.slice(0, 7),
        action: { kind: 'revert', commit }
      }),
    onDropCommit: (commit: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.dropCommit', 'Drop commit'),
        description: translate(
          'auto.components.git.graph.dialog.dropCommitDescription',
          'Remove this commit from the current branch. A backup ref is created first.'
        ),
        action: { kind: 'dropCommit', commit }
      }),
    onReset: (commit: string) => setDialogRequest({ kind: 'reset', target: commit, mode: 'mixed' }),
    onCreateTag: (target: string) =>
      setDialogRequest({ kind: 'createTag', target, name: '', message: '', push: false }),
    onDeleteTag: (name: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.deleteTag', 'Delete tag {{value0}}', {
          value0: name
        }),
        description: translate(
          'auto.components.git.graph.dialog.deleteTagDescription',
          'Delete the tag from this repository.'
        ),
        action: { kind: 'deleteTag', name }
      }),
    onPushTag: (name: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.pushTag', 'Push tag {{value0}}', {
          value0: name
        }),
        description: translate(
          'auto.components.git.graph.dialog.pushTagDescription',
          'Push the tag to the default remote.'
        ),
        action: { kind: 'pushTag', name }
      }),
    onCompare: (commit: string) =>
      setSelectedIds((previous) =>
        previous.length === 1 && previous[0] !== commit ? [previous[0], commit] : [commit]
      )
  }

  const confirmDialog = (action: GitGraphAction): void => {
    setDialogRequest(null)
    void runAction(action)
  }

  const runSync = async (kind: 'fetch' | 'pull' | 'push'): Promise<void> => {
    if (!worktree?.path || !ownerTarget) {
      return
    }
    setSyncBusy(true)
    try {
      const context = {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath: worktree.path,
        connectionId: getConnectionId(worktreeId) ?? undefined
      }
      if (kind === 'fetch') {
        await fetchRuntimeGit(context)
      } else if (kind === 'pull') {
        await pullRuntimeGit(context)
      } else {
        await pushRuntimeGit(context)
      }
      toast.success(
        translate('auto.components.git.graph.sync.completed', 'Git {{value0}} completed.', {
          value0: kind
        })
      )
      refresh()
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setSyncBusy(false)
    }
  }

  const branchLabel =
    shortRefName(worktree?.branch ?? '') ||
    shortRefName(result?.currentRef?.name ?? '') ||
    worktree?.path ||
    ''

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
        backupCount={auxRefs.backups.length}
        onFetch={() => void runSync('fetch')}
        onPull={() => setPendingSync('pull')}
        onPush={() => setPendingSync('push')}
        onStashes={() => setAuxDialog('stashes')}
        onBackups={() => setAuxDialog('backups')}
        onRemotes={() => setRemoteOpen(true)}
        onStash={() =>
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

      {result?.scope === 'head' && (
        <div className="shrink-0 border-b border-annotation-highlight/30 bg-annotation-highlight/5 px-3 py-1 text-[11px] text-annotation-highlight">
          {translate(
            'auto.components.git.graph.pane.oldRuntime',
            'This runtime does not support the all-branch graph. Showing the current branch only.'
          )}
        </div>
      )}

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
            {status === 'loading' && !result && (
              <div className="p-4 text-xs text-muted-foreground">
                {translate('auto.components.git.graph.pane.loading', 'Loading graph...')}
              </div>
            )}
            {status === 'error' && !result && (
              <div className="p-4 text-xs text-destructive">{error}</div>
            )}
            {result && result.items.length === 0 && (
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
                  disabled={status === 'refreshing'}
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
        <Dialog open onOpenChange={(open) => !open && setPendingSync(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {pendingSync === 'pull'
                  ? translate('auto.components.git.graph.sync.pull', 'Pull')
                  : translate('auto.components.git.graph.sync.push', 'Push')}
              </DialogTitle>
              <DialogDescription>
                {pendingSync === 'pull'
                  ? translate(
                      'auto.components.git.graph.sync.pullDescription',
                      'Pull from the upstream branch into this worktree.'
                    )
                  : translate(
                      'auto.components.git.graph.sync.pushDescription',
                      'Push this worktree branch to its remote.'
                    )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendingSync(null)}>
                {translate('auto.components.git.graph.dialog.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const kind = pendingSync
                  setPendingSync(null)
                  void runSync(kind)
                }}
              >
                {translate('auto.components.git.graph.dialog.confirm', 'Run')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
