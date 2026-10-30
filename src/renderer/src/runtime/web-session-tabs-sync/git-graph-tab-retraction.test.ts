import { beforeEach, expect, it } from 'vitest'
import {
  ENV,
  makeSnapshot,
  makeState,
  resetWebSessionTabsSyncTestState,
  WT
} from '../web-session-tabs-sync-test-harness'
import { applyWebSessionTabsSnapshotWithContext } from './apply-snapshot'

beforeEach(resetWebSessionTabsSyncTestState)

it('drops a Git Graph tab the web session mirrored from the desktop', () => {
  const state = makeState({
    unifiedTabsByWorktree: {
      [WT]: [
        {
          id: 'git-graph-tab',
          entityId: 'git-graph-tab',
          groupId: 'host-group-1',
          worktreeId: WT,
          contentType: 'git-graph',
          label: 'Git Graph',
          customLabel: null,
          color: null,
          sortOrder: 0,
          createdAt: 1_700_000_000_000
        }
      ]
    }
  })

  const next = applyWebSessionTabsSnapshotWithContext(
    state,
    makeSnapshot([]),
    ENV,
    1_700_000_000_000
  )

  expect(next.unifiedTabsByWorktree?.[WT] ?? []).toEqual([])
})
