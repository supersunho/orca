import { useEffect, useMemo, useState } from 'react'
import { getRuntimeGitStatus } from '@/runtime/runtime-git-status-client'
import { getConnectionId } from '@/lib/connection-context'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import type { GitStatusResult } from '../../../../shared/git-status-types'
import type { ConflictReviewEntry } from '../../../../shared/editor-tab-view-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

export function useGitGraphWorktreeStatus({
  worktreeId,
  worktreePath,
  ownerTarget,
  refreshKey,
  conflict
}: {
  worktreeId: string
  worktreePath: string | null
  ownerTarget: RuntimeClientTarget | null
  refreshKey: unknown
  conflict: unknown
}): {
  worktreeStatus: GitStatusResult | null
  conflictEntries: ConflictReviewEntry[]
  hasWorkingTreeChanges: boolean
  workingTreeChangeCount: number
} {
  const [worktreeStatus, setWorktreeStatus] = useState<GitStatusResult | null>(null)

  useEffect(() => {
    if (!worktreePath || !ownerTarget) {
      setWorktreeStatus(null)
      return
    }
    let cancelled = false
    void getRuntimeGitStatus(
      {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      { admissionTier: 'background' }
    )
      .then((next) => {
        if (!cancelled) {
          setWorktreeStatus(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorktreeStatus(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [worktreePath, ownerTarget, worktreeId, refreshKey, conflict])

  const conflictEntries = useMemo<ConflictReviewEntry[]>(
    () =>
      worktreeStatus?.entries.flatMap((entry) =>
        entry.conflictKind ? [{ path: entry.path, conflictKind: entry.conflictKind }] : []
      ) ?? [],
    [worktreeStatus]
  )
  const hasWorkingTreeChanges = Boolean(
    worktreeStatus && (worktreeStatus.entries.length > 0 || (worktreeStatus.statusLength ?? 0) > 0)
  )
  const workingTreeChangeCount = worktreeStatus?.statusLength ?? worktreeStatus?.entries.length ?? 0

  return { worktreeStatus, conflictEntries, hasWorkingTreeChanges, workingTreeChangeCount }
}
