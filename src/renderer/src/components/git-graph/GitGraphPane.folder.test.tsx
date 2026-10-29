// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  useWorktreeById: () => folderWorktree
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

afterEach(cleanup)

function configureHooks(): void {
  mocks.history.mockReturnValue({
    result: null,
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
  mocks.viewModels.mockReturnValue({ worktreeHeads: new Map(), viewModels: [] })
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
    const { getByText, queryByTestId } = render(<GitGraphPane worktreeId="folder:group" />)

    expect(getByText('Git Graph is only available for Git worktrees.')).toBeTruthy()
    expect(queryByTestId('git-graph-row')).toBeNull()
    expect(mocks.history).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
    expect(mocks.auxRefs).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: null, ownerTarget: null })
    )
  })
})
