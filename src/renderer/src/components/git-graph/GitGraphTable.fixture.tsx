import { defineFixture } from '../../component-fixtures/component-fixture'
import { buildGitHistoryViewModels } from '../../../../shared/git-history-graph'
import type { GitHistoryItemViewModel } from '../../../../shared/git-history-graph'
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

const side = {
  id: 'd4e5f60718293a4b5c6d7e8f9012345678901234',
  parentIds: [middle.id],
  subject: 'feat: parallel agent worktree',
  message: 'feat: parallel agent worktree',
  displayId: 'd4e5f60',
  author: 'Agent',
  timestamp: timestamps.middle
}

const merge = {
  id: 'e5f60718293a4b5c6d7e8f901234567890123456',
  parentIds: [newest.id, side.id],
  subject: 'Merge branch feature into main',
  message: 'Merge branch feature into main',
  displayId: 'e5f6071',
  author: 'Sunho',
  timestamp: timestamps.newest,
  references: [
    {
      id: 'refs/heads/main',
      name: 'main',
      category: 'branches' as const,
      color: 'git-graph-lane-2' as const
    }
  ]
}

const mergeViewModels = buildGitHistoryViewModels([merge, newest, side, middle, root], new Map(), {
  id: 'refs/heads/main',
  name: 'main',
  revision: merge.id
})

const viewModels: GitHistoryItemViewModel[] = [
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

const largeItems = Array.from({ length: 1_000 }, (_, index) => ({
  id: `${index.toString(16).padStart(8, '0')}00000000000000000000000000000000`,
  parentIds:
    index === 999
      ? []
      : [`${(index + 1).toString(16).padStart(8, '0')}00000000000000000000000000000000`],
  subject: `Commit ${index + 1}`,
  message: `Commit ${index + 1}`,
  displayId: index.toString(16).padStart(7, '0'),
  author: index % 2 === 0 ? 'Sunho' : 'Agent',
  timestamp: timestamps.newest - index * 60_000
}))

const largeViewModels = buildGitHistoryViewModels(largeItems, new Map(), {
  id: 'refs/heads/main',
  name: 'main',
  revision: largeItems[0]?.id
})

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

function table(
  width: number,
  settings = defaultGitGraphViewSettings(),
  models = viewModels,
  height?: number
) {
  const headItem = models[0]?.historyItem
  return (
    <div style={{ width, ...(height ? { height } : {}) }}>
      <GitGraphTable
        status="idle"
        result={{
          items: models.map((model) => model.historyItem),
          hasIncomingChanges: false,
          hasOutgoingChanges: false,
          hasMore: true,
          limit: models.length,
          scope: 'all-refs'
        }}
        error={null}
        viewSettings={settings}
        viewModels={models}
        worktreeHeads={new Map(headItem ? [[headItem.id, ['main']]] : [])}
        actionContextHeadId={headItem?.id ?? null}
        selectedIds={models[1] ? [models[1].historyItem.id] : []}
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
        onNavigate={() => undefined}
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

export const mergeMuted = defineFixture({
  width: 900,
  render: () => table(900, { ...defaultGitGraphViewSettings(), muteMerges: true }, mergeViewModels)
})

export const large = defineFixture({
  width: 900,
  render: () => table(900, defaultGitGraphViewSettings(), largeViewModels, 420)
})
