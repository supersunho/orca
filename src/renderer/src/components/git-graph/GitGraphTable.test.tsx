// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type { GitHistoryItemViewModel } from '../../../../shared/git-history-graph'
import type { GitGraphActionMenuHandlers } from './GitGraphActionMenu'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 32,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: `row-${index}`,
        start: index * 32
      })),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn()
  })
}))
import { GitGraphTable } from './GitGraphTable'
import { defaultGitGraphViewSettings } from './git-graph-view-settings'

afterEach(cleanup)

const items: GitHistoryItem[] = [
  {
    id: 'commit-a',
    parentIds: ['commit-b'],
    subject: 'A',
    message: 'A',
    author: 'Ada',
    timestamp: 1
  },
  {
    id: 'commit-b',
    parentIds: ['commit-c'],
    subject: 'B',
    message: 'B',
    author: 'Ada',
    timestamp: 2
  },
  { id: 'commit-c', parentIds: [], subject: 'C', message: 'C', author: 'Ada', timestamp: 3 }
]

const viewModels: GitHistoryItemViewModel[] = items.map((item) => ({
  historyItem: item,
  inputSwimlanes: [],
  outputSwimlanes: [],
  kind: 'node'
}))

const handlers: GitGraphActionMenuHandlers = {
  onCheckoutRef: vi.fn(),
  onCreateBranch: vi.fn(),
  onRenameBranch: vi.fn(),
  onDeleteBranch: vi.fn(),
  onMerge: vi.fn(),
  onRebase: vi.fn(),
  onCherryPick: vi.fn(),
  onRevert: vi.fn(),
  onDropCommit: vi.fn(),
  onReset: vi.fn(),
  onCreateTag: vi.fn(),
  onDeleteTag: vi.fn(),
  onPushTag: vi.fn(),
  onCompare: vi.fn()
}

function renderTable(onClearSelection = vi.fn(), onNavigate = vi.fn()) {
  return {
    onClearSelection,
    onNavigate,
    ...render(
      <GitGraphTable
        status="idle"
        result={{
          items,
          hasIncomingChanges: false,
          hasOutgoingChanges: false,
          hasMore: false,
          limit: 3,
          scope: 'all-refs'
        }}
        error={null}
        viewSettings={defaultGitGraphViewSettings()}
        viewModels={viewModels}
        worktreeHeads={new Map()}
        actionContextHeadId={null}
        selectedIds={[]}
        activeRefFilter={[]}
        hasWorktreeStatus
        hasWorkingTreeChanges={false}
        workingTreeChangeCount={0}
        statusCapped={false}
        statusReadError={null}
        showStashRows
        stashes={[]}
        actionBusy={false}
        onStash={vi.fn()}
        onApplyStash={vi.fn()}
        onSelect={vi.fn()}
        onToggleRefFilter={vi.fn()}
        menuHandlers={handlers}
        onColumnResize={vi.fn()}
        onClearSelection={onClearSelection}
        onNavigate={onNavigate}
        onLoadMore={vi.fn()}
      />
    )
  }
}

describe('GitGraphTable keyboard navigation', () => {
  it('moves row focus and selection with arrows, Home, and End', () => {
    const { getAllByTestId, onNavigate } = renderTable()
    const rows = getAllByTestId('git-graph-row')
    rows[0]?.focus()

    fireEvent.keyDown(rows[0]!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[1])
    expect(onNavigate).toHaveBeenLastCalledWith(items[1])
    fireEvent.keyDown(rows[1]!, { key: 'End' })
    expect(document.activeElement).toBe(rows[2])
    expect(onNavigate).toHaveBeenLastCalledWith(items[2])
    fireEvent.keyDown(rows[2]!, { key: 'Home' })
    expect(document.activeElement).toBe(rows[0])
    expect(onNavigate).toHaveBeenLastCalledWith(items[0])
  })

  it('clears selection on Escape', () => {
    const { getAllByTestId, onClearSelection } = renderTable()

    fireEvent.keyDown(getAllByTestId('git-graph-row')[0]!, { key: 'Escape' })

    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })
})
