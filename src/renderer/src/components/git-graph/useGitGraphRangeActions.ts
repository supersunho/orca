import { useCallback } from 'react'
import { detectLanguage } from '@/lib/language-detect'
import type { AppState } from '@/store/types'
import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import type { GitGraphRangeCompareState } from './GitGraphDetailsPanel'

export function useGitGraphRangeActions({
  rangeCompare,
  worktreeId,
  worktreePath,
  openCommitDiff,
  openCommitAllDiffs
}: {
  rangeCompare: GitGraphRangeCompareState | null
  worktreeId: string
  worktreePath: string | null
  openCommitDiff: AppState['openCommitDiff']
  openCommitAllDiffs: AppState['openCommitAllDiffs']
}): {
  openRangeFile: (entry: GitBranchChangeEntry) => void
  openRangeDiff: () => void
} {
  const openRangeFile = useCallback(
    (entry: GitBranchChangeEntry) => {
      if (!rangeCompare || !worktreePath) {
        return
      }
      openCommitDiff(
        worktreeId,
        worktreePath,
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
    [openCommitDiff, rangeCompare, worktreePath, worktreeId]
  )

  const openRangeDiff = useCallback(() => {
    if (!rangeCompare || !worktreePath) {
      return
    }
    const baseRef = rangeCompare.base.id.slice(0, 7)
    const compareRef = rangeCompare.head.id.slice(0, 7)
    openCommitAllDiffs(
      worktreeId,
      worktreePath,
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
  }, [openCommitAllDiffs, rangeCompare, worktreePath, worktreeId])

  return { openRangeFile, openRangeDiff }
}
