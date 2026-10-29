import { defineFixture } from '../../component-fixtures/component-fixture'
import type { GitGraphActionMenuHandlers } from './GitGraphActionMenu'
import { GitGraphTable } from './GitGraphTable'
import { defaultGitGraphViewSettings } from './git-graph-view-settings'

const timestamps = {
  newest: Date.UTC(2026, 9, 29, 9, 30),
  middle: Date.UTC(2026, 9, 28, 16, 10),
  root: Date.UTC(2026, 9, 24, 11, 45)
}

const newest = {
  id: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  parentIds: ['b2c3d4e5f60718293a4b5c6d7e8f901234567890'],
  subject: 'feat(git-graph): persist view settings',
  message: 'feat(git-graph): persist view settings',
  displayId: 'a1b2c3d',
  author: 'Sunho',
  timestamp: timestamps.newest,
  references: [
    {
      id: 'refs/heads/main',
      name: 'main',
      category: 'branches' as const,
      color: 'git-graph-lane-2' as const
    },
    { id: 'refs/remotes/origin/main', name: 'origin/main', category: 'remote branches' as const }
  ]
}

const middle = {
  id: 'b2c3d4e5f60718293a4b5c6d7e8f901234567890',
  parentIds: ['c3d4e5f60718293a4b5c6d7e8f90123456789012'],
  subject: 'fix(git-graph): gate folder workspace requests',
  message: 'fix(git-graph): gate folder workspace requests',
  displayId: 'b2c3d4e',
  author: 'Sunho',
  timestamp: timestamps.middle,
  references: [
    {
      id: 'refs/tags/v1.4.0',
      name: 'v1.4.0',
      category: 'tags' as const,
      color: 'git-graph-lane-3' as const
    }
  ]
}

const root = {
  id: 'c3d4e5f60718293a4b5c6d7e8f90123456789012',
  parentIds: [],
  subject: 'chore: initial import',
  message: 'chore: initial import',
  displayId: 'c3d4e5f',
  author: 'Orca',
  timestamp: timestamps.root
}

const viewModels = [
  {
    historyItem: newest,
    inputSwimlanes: [],
    outputSwimlanes: [{ id: middle.id, color: 'git-graph-lane-2' as const }],
    kind: 'HEAD' as const
  },
  {
    historyItem: middle,
    inputSwimlanes: [{ id: middle.id, color: 'git-graph-lane-2' as const }],
    outputSwimlanes: [{ id: root.id, color: 'git-graph-lane-3' as const }],
    kind: 'node' as const
  },
  {
    historyItem: root,
    inputSwimlanes: [{ id: root.id, color: 'git-graph-lane-3' as const }],
    outputSwimlanes: [],
    kind: 'node' as const
  }
]

const handlers: GitGraphActionMenuHandlers = {
  onCheckoutRef: () => undefined,
  onCreateBranch: () => undefined,
  onRenameBranch: () => undefined,
  onDeleteBranch: () => undefined,
  onMerge: () => undefined,
  onRebase: () => undefined,
  onCherryPick: () => undefined,
  onRevert: () => undefined,
  onDropCommit: () => undefined,
  onReset: () => undefined,
  onCreateTag: () => undefined,
  onDeleteTag: () => undefined,
  onPushTag: () => undefined,
  onCompare: () => undefined
}

function table(width: number) {
  return (
    <div style={{ width }}>
      <GitGraphTable
        status="idle"
        result={{
          items: [newest, middle, root],
          hasIncomingChanges: false,
          hasOutgoingChanges: false,
          hasMore: true,
          limit: 3,
          scope: 'all-refs'
        }}
        error={null}
        viewSettings={defaultGitGraphViewSettings()}
        viewModels={viewModels}
        worktreeHeads={new Map([[newest.id, ['main']]])}
        actionContextHeadId={newest.id}
        selectedIds={[middle.id]}
        activeRefFilter={[]}
        hasWorktreeStatus
        hasWorkingTreeChanges={false}
        workingTreeChangeCount={0}
        statusCapped={false}
        statusReadError={null}
        showStashRows
        stashes={[]}
        actionBusy={false}
        onStash={() => undefined}
        onApplyStash={() => undefined}
        onSelect={() => undefined}
        onToggleRefFilter={() => undefined}
        menuHandlers={handlers}
        onColumnResize={() => undefined}
        onClearSelection={() => undefined}
        onLoadMore={() => undefined}
      />
    </div>
  )
}

export const wide = defineFixture({
  width: 900,
  render: () => table(900)
})

export const compact = defineFixture({
  width: 480,
  render: () => table(480)
})
