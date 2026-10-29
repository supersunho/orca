import { useMemo } from 'react'
import {
  buildDefaultGitHistoryColorMap,
  buildGitHistoryViewModels,
  type GitHistoryItemViewModel
} from '../../../../shared/git-history-graph'
import type { GitHistoryResult } from '../../../../shared/git-history'
import type { Worktree } from '../../../../shared/worktree/types'

export function useGitGraphViewModels({
  worktrees,
  result
}: {
  worktrees: readonly Worktree[]
  result: GitHistoryResult | null
}): {
  worktreeHeads: Map<string, string[]>
  viewModels: GitHistoryItemViewModel[]
} {
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

  return { worktreeHeads, viewModels }
}
