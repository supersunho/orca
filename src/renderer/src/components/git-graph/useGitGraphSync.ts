import { useState } from 'react'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { getConnectionId } from '@/lib/connection-context'
import { fetchRuntimeGit, pullRuntimeGit, pushRuntimeGit } from '@/runtime/runtime-git-sync-client'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import { translate } from '@/i18n/i18n'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

export function useGitGraphSync({
  worktreeId,
  worktreePath,
  ownerTarget,
  onCompleted
}: {
  worktreeId: string
  worktreePath: string | null
  ownerTarget: RuntimeClientTarget | null
  onCompleted: () => void
}): {
  syncBusy: boolean
  runSync: (kind: 'fetch' | 'pull' | 'push' | 'forcePush') => Promise<void>
} {
  const [syncBusy, setSyncBusy] = useState(false)
  const pushBranch = useAppStore((state) => state.pushBranch)

  const runSync = async (kind: 'fetch' | 'pull' | 'push' | 'forcePush'): Promise<void> => {
    if (!worktreePath || !ownerTarget) {
      return
    }
    setSyncBusy(true)
    try {
      const context = {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath,
        connectionId: getConnectionId(worktreeId) ?? undefined
      }
      if (kind === 'fetch') {
        await fetchRuntimeGit(context)
      } else if (kind === 'pull') {
        await pullRuntimeGit(context)
      } else if (kind === 'forcePush') {
        await pushBranch(worktreeId, worktreePath, false, context.connectionId, undefined, {
          forceWithLease: true,
          runtimeTarget: context.target
        })
      } else {
        await pushRuntimeGit(context)
      }
      toast.success(
        translate('auto.components.git.graph.sync.completed', 'Git {{value0}} completed.', {
          value0: kind
        })
      )
      onCompleted()
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setSyncBusy(false)
    }
  }

  return { syncBusy, runSync }
}
