import { useEffect, useState } from 'react'
import { getConnectionId } from '@/lib/connection-context'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { getRuntimeGitGraphAuxRefs } from '@/runtime/runtime-git-graph-client'
import type { GitGraphAuxRefs } from '../../../../shared/git-graph-actions'

const EMPTY_AUX_REFS: GitGraphAuxRefs = { stashes: [], backups: [] }

export function useGitGraphAuxRefs({
  worktreeId,
  worktreePath,
  ownerTarget,
  refreshKey
}: {
  worktreeId: string
  worktreePath: string | null
  ownerTarget: RuntimeClientTarget | null
  refreshKey: unknown
}): GitGraphAuxRefs {
  const [refs, setRefs] = useState<GitGraphAuxRefs>(EMPTY_AUX_REFS)

  useEffect(() => {
    if (!worktreePath || !ownerTarget) {
      setRefs(EMPTY_AUX_REFS)
      return
    }
    let cancelled = false
    void getRuntimeGitGraphAuxRefs({
      target: requireGitOwnerTarget(ownerTarget),
      worktreeId,
      worktreePath,
      connectionId: getConnectionId(worktreeId) ?? undefined
    })
      .then((next) => {
        if (!cancelled) {
          setRefs(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRefs(EMPTY_AUX_REFS)
        }
      })
    return () => {
      cancelled = true
    }
  }, [worktreeId, worktreePath, ownerTarget, refreshKey])

  return refs
}
