import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { createBrowserUuid } from './browser-uuid'
import type { ExecutionHostId } from '../../../shared/execution-host'

export function getGitGraphTabForWorktree(
  worktreeId: string,
  executionHostId?: ExecutionHostId
): { id: string; groupId: string } | null {
  const tabs = useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? []
  const tab = tabs.find(
    (candidate) =>
      candidate.contentType === 'git-graph' &&
      (executionHostId === undefined || candidate.executionHostId === executionHostId)
  )
  return tab ? { id: tab.id, groupId: tab.groupId } : null
}

/** Open or focus the single Git Graph tab for this worktree. */
export function ensureGitGraphTab(
  worktreeId: string,
  executionHostId?: ExecutionHostId
): string | null {
  const state = useAppStore.getState()
  const targetGroupId =
    state.activeGroupIdByWorktree[worktreeId] ?? state.groupsByWorktree[worktreeId]?.[0]?.id
  if (!targetGroupId) {
    return null
  }

  const existing = getGitGraphTabForWorktree(worktreeId, executionHostId)
  if (existing) {
    state.activateTab(existing.id)
    state.focusGroup(worktreeId, existing.groupId)
    state.setActiveTabType('git-graph', worktreeId)
    return existing.id
  }

  const tab = state.createUnifiedTab(worktreeId, 'git-graph', {
    id: createBrowserUuid(),
    label: translate('auto.lib.ensure.git.graph.tab', 'Git Graph'),
    targetGroupId,
    activate: true,
    ...(executionHostId ? { executionHostId } : {})
  })
  state.setActiveTabType('git-graph', worktreeId)
  return tab.id
}
