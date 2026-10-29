// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY } from './git-graph-view-settings'

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  auxRefs: vi.fn(),
  actions: vi.fn(),
  status: vi.fn(),
  selection: vi.fn(),
  viewModels: vi.fn(),
  rangeActions: vi.fn(),
  menuHandlers: vi.fn(),
  sync: vi.fn(),
  historyCommitActions: vi.fn()
}))

const folderWorktree = {
  id: 'folder:group',
  repoId: 'folder-workspace:group',
  path: '/folder',
  branch: null,
  head: null
}

const gitWorktree = {
  id: 'worktree-a',
  repoId: 'repo-a',
  path: '/repo',
  branch: 'refs/heads/main',
  head: 'commit-a'
}

const commit = {
  id: 'commit-a',
  parentIds: [],
  subject: 'Initial commit',
  message: 'Initial commit',
  author: 'Ada',
  timestamp: Date.now()
}

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      openCommitDiff: vi.fn(),
      openCommitAllDiffs: vi.fn(),
      openConflictReview: vi.fn(),
      worktreesByRepo: {}
    })
}))
vi.mock('@/store/selectors', () => ({
  useWorktreeById: (id: string) => (id.startsWith('folder:') ? folderWorktree : gitWorktree)
}))
vi.mock('../right-sidebar/worktree-git-owner-target', () => ({
  useWorktreeGitOwnerTarget: () => ({ kind: 'local' }),
  requireGitOwnerTarget: (target: unknown) => target
}))
vi.mock('../right-sidebar/source-control/sync/use-git-history-commit-actions', () => ({
  useGitHistoryCommitActions: mocks.historyCommitActions
}))
vi.mock('./useGitGraphHistory', () => ({ useGitGraphHistory: mocks.history }))
vi.mock('./useGitGraphAuxRefs', () => ({ useGitGraphAuxRefs: mocks.auxRefs }))
vi.mock('./useGitGraphActions', () => ({ useGitGraphActions: mocks.actions }))
vi.mock('./useGitGraphWorktreeStatus', () => ({ useGitGraphWorktreeStatus: mocks.status }))
vi.mock('./useGitGraphCommitSelection', () => ({ useGitGraphCommitSelection: mocks.selection }))
vi.mock('./useGitGraphViewModels', () => ({ useGitGraphViewModels: mocks.viewModels }))
vi.mock('./useGitGraphRangeActions', () => ({ useGitGraphRangeActions: mocks.rangeActions }))
vi.mock('./useGitGraphMenuHandlers', () => ({ useGitGraphMenuHandlers: mocks.menuHandlers }))
vi.mock('./useGitGraphSync', () => ({ useGitGraphSync: mocks.sync }))

import GitGraphPane from './GitGraphPane'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function renderPane(worktreeId: string) {
  return render(
    <TooltipProvider>
      <GitGraphPane worktreeId={worktreeId} />
    </TooltipProvider>
  )
}

function configureHooks(withCommit = false): void {
  mocks.history.mockReturnValue({
    result: withCommit
      ? {
          items: [commit],
          hasIncomingChanges: false,
          hasOutgoingChanges: false,
          hasMore: false,
          limit: 1,
          scope: 'all-refs'
        }
      : null,
    status: 'idle',
    error: null,
    searchDraft: '',
    setSearchDraft: vi.fn(),
    refFilter: [],
    setRefFilter: vi.fn(),
    refresh: vi.fn(),
    loadMore: vi.fn()
  })
  mocks.auxRefs.mockReturnValue({ stashes: [], backups: [] })
  mocks.actions.mockReturnValue({
    busy: false,
    conflict: null,
    runAction: vi.fn(),
    clearConflict: vi.fn()
  })
  mocks.status.mockReturnValue({
    worktreeStatus: null,
    conflictEntries: [],
    hasWorkingTreeChanges: false,
    workingTreeChangeCount: 0,
    statusCapped: false,
    statusReadError: null
  })
  mocks.selection.mockReturnValue({
    singleSelected: null,
    files: [],
    filesStatus: 'idle',
    filesError: null,
    rangeCompare: null
  })
  mocks.viewModels.mockReturnValue({
    worktreeHeads: withCommit ? new Map([['commit-a', ['main']]]) : new Map(),
    viewModels: withCommit
      ? [
          {
            historyItem: commit,
            inputSwimlanes: [],
            outputSwimlanes: [],
            kind: 'node'
          }
        ]
      : []
  })
  mocks.rangeActions.mockReturnValue({ openRangeFile: vi.fn(), openRangeDiff: vi.fn() })
  mocks.menuHandlers.mockReturnValue({})
  mocks.sync.mockReturnValue({ syncBusy: false, runSync: vi.fn() })
  mocks.historyCommitActions.mockReturnValue({
    loadCommitFiles: vi.fn(),
    openHistoryCommitDiff: vi.fn(),
    openCommitFile: vi.fn()
  })
}

describe('GitGraphPane folder workspace', () => {
  it('renders the empty state and passes null Git inputs to hooks', () => {
    configureHooks()
    const { getByText, queryByTestId } = renderPane('folder:group')

    expect(getByText('Git Graph is only available for Git worktrees.')).toBeTruthy()
    expect(queryByTestId('git-graph-row')).toBeNull()
    expect(mocks.history).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
    expect(mocks.auxRefs).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
    expect(mocks.status).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
    expect(mocks.actions).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
    expect(mocks.selection).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
    expect(mocks.sync).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
    expect(mocks.historyCommitActions).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, activeRepoTarget: null })
    )
    expect(mocks.rangeActions).toHaveBeenCalledWith(expect.objectContaining({ worktreePath: null }))
  })

  it('persists author-column visibility and restores it on remount', async () => {
    configureHooks(true)
    const first = renderPane('worktree-a')
    expect(first.getByText('Ada')).toBeTruthy()

    fireEvent.keyDown(first.getByRole('button', { name: 'Git Graph view settings' }), {
      key: 'Enter'
    })
    await waitFor(() => {
      const item = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')
      ).find((candidate) => candidate.textContent === 'Author column')
      expect(item).toBeTruthy()
      if (item) {
        fireEvent.keyDown(item, { key: 'Enter' })
      }
    })

    await waitFor(() => expect(first.queryByText('Ada')).toBeNull())
    const stored = JSON.parse(
      window.localStorage.getItem(GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY) ?? '{}'
    )
    expect(stored.showAuthor).toBe(false)

    first.unmount()
    configureHooks(true)
    const second = renderPane('worktree-a')
    expect(second.queryByText('Ada')).toBeNull()
  })

  it('persists a keyboard column resize', async () => {
    configureHooks(true)
    const first = renderPane('worktree-a')

    fireEvent.keyDown(first.getByRole('separator', { name: 'Resize author column' }), {
      key: 'ArrowRight'
    })

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY) ?? '{}'
      )
      expect(stored.authorWidth).toBe(140)
    })

    first.unmount()
    configureHooks(true)
    const second = renderPane('worktree-a')
    expect(
      second.getByRole('separator', { name: 'Resize author column' }).getAttribute('aria-valuenow')
    ).toBe('140')
  })
})
