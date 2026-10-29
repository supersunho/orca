import type { Worktree } from '../../../../shared/worktree/types'
import {
  areLocalWindowsWslPathAliases,
  normalizeRuntimePathForComparison
} from '../../../../shared/cross-platform-path'

type WorktreeRedirectCandidate = Pick<Worktree, 'id' | 'repoId' | 'hostId' | 'path'>

export function findOccupiedWorktree<T extends WorktreeRedirectCandidate>(
  worktrees: readonly T[],
  occupiedPath: string,
  context: Pick<Worktree, 'repoId' | 'hostId'>
): T | null {
  return (
    worktrees.find(
      (candidate) =>
        candidate.repoId === context.repoId &&
        candidate.hostId === context.hostId &&
        (normalizeRuntimePathForComparison(candidate.path) ===
          normalizeRuntimePathForComparison(occupiedPath) ||
          areLocalWindowsWslPathAliases(candidate.path, occupiedPath))
    ) ?? null
  )
}
