import { useEffect, useMemo, useState } from 'react'
import { getRuntimeGitStatus } from '@/runtime/runtime-git-status-client'
import { getConnectionId } from '@/lib/connection-context'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import type { GitStatusResult } from '../../../../shared/git-status-types'
import type { ConflictReviewEntry } from '../../../../shared/editor-tab-view-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

function targetIdentity(target: RuntimeClientTarget | null): string {
  if (!target) {
    return 'none'
  }
  return target.kind === 'environment' ? `environment:${target.environmentId}` : 'local'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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
  statusCapped: boolean
  statusReadError: string | null
} {
  const connectionId = getConnectionId(worktreeId) ?? undefined
  const requestKey =
    worktreePath && ownerTarget
      ? `${worktreeId}\u0000${worktreePath}\u0000${targetIdentity(ownerTarget)}\u0000${connectionId ?? ''}`
      : null
  const [stored, setStored] = useState<{
    key: string
    status: GitStatusResult | null
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!requestKey || !worktreePath || !ownerTarget) {
      setStored(null)
      return
    }
    const controller = new AbortController()
    void getRuntimeGitStatus(
      {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath,
        connectionId
      },
      { admissionTier: 'background', signal: controller.signal }
    )
      .then((next) => {
        if (!controller.signal.aborted) {
          setStored({ key: requestKey, status: next, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStored({ key: requestKey, status: null, error: errorMessage(error) })
        }
      })
    return () => controller.abort()
  }, [requestKey, worktreePath, worktreeId, ownerTarget, connectionId, refreshKey, conflict])

  const current = stored?.key === requestKey ? stored : null
  const worktreeStatus = current?.status ?? null
  const conflictEntries = useMemo<ConflictReviewEntry[]>(
    () =>
      worktreeStatus && !worktreeStatus.readError
        ? worktreeStatus.entries.flatMap((entry) =>
            entry.conflictKind ? [{ path: entry.path, conflictKind: entry.conflictKind }] : []
          )
        : [],
    [worktreeStatus]
  )
  const statusReadError = current?.error ?? worktreeStatus?.readError ?? null
  const statusCapped = Boolean(worktreeStatus?.didHitLimit && !statusReadError)
  const hasWorkingTreeChanges = Boolean(
    worktreeStatus &&
    !statusReadError &&
    (worktreeStatus.entries.length > 0 || (worktreeStatus.statusLength ?? 0) > 0)
  )
  const workingTreeChangeCount =
    !worktreeStatus || statusReadError
      ? 0
      : (worktreeStatus.statusLength ?? worktreeStatus.entries.length)

  return {
    worktreeStatus,
    conflictEntries,
    hasWorkingTreeChanges,
    workingTreeChangeCount,
    statusCapped,
    statusReadError
  }
}
