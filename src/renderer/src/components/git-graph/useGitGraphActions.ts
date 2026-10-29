import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getConnectionId } from '@/lib/connection-context'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { runRuntimeGitGraphAction } from '@/runtime/runtime-git-graph-client'
import type {
  GitGraphAction,
  GitGraphConflictOperation,
  GitGraphActionResult
} from '../../../../shared/git-graph-actions'
import { translate } from '@/i18n/i18n'

export type GitGraphConflictState = {
  operation: GitGraphConflictOperation
  message: string
}

export function useGitGraphActions({
  worktreeId,
  worktreePath,
  ownerTarget,
  onCompleted,
  onOccupiedBranch
}: {
  worktreeId: string
  worktreePath: string | null
  ownerTarget: RuntimeClientTarget | null
  onCompleted: () => void
  onOccupiedBranch?: (worktreePath: string) => void
}): {
  busy: boolean
  conflict: GitGraphConflictState | null
  runAction: (action: GitGraphAction) => Promise<GitGraphActionResult | null>
  clearConflict: () => void
} {
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState<GitGraphConflictState | null>(null)

  const runAction = useCallback(
    async (action: GitGraphAction): Promise<GitGraphActionResult | null> => {
      if (!worktreePath || !ownerTarget) {
        toast.error(
          translate(
            'auto.components.git.graph.actions.noWorktree',
            'This worktree is not available for Git actions.'
          )
        )
        return null
      }
      setBusy(true)
      try {
        const result = await runRuntimeGitGraphAction(
          {
            target: requireGitOwnerTarget(ownerTarget),
            worktreeId,
            worktreePath,
            connectionId: getConnectionId(worktreeId) ?? undefined
          },
          action
        )
        if (result.ok) {
          setConflict(null)
          toast.success(
            result.backupRef
              ? translate(
                  'auto.components.git.graph.actions.completedWithBackup',
                  'Git action completed. Backup: {{value0}}',
                  { value0: result.backupRef }
                )
              : translate('auto.components.git.graph.actions.completed', 'Git action completed.')
          )
          onCompleted()
          return result
        }
        if (result.code === 'conflict' && result.conflict) {
          setConflict({ operation: result.conflict, message: result.message })
          return result
        }
        const occupiedWorktree = result.occupiedWorktree
        if (result.code === 'occupied-branch' && occupiedWorktree && onOccupiedBranch) {
          toast.error(result.message, {
            action: {
              label: translate(
                'auto.components.git.graph.actions.openOccupiedWorktree',
                'Open worktree'
              ),
              onClick: () => onOccupiedBranch(occupiedWorktree)
            }
          })
          return result
        }
        toast.error(result.message)
        return result
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
        return null
      } finally {
        setBusy(false)
      }
    },
    [onCompleted, onOccupiedBranch, ownerTarget, worktreeId, worktreePath]
  )

  const clearConflict = useCallback(() => setConflict(null), [])

  return { busy, conflict, runAction, clearConflict }
}
