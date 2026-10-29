import { ipcMain } from 'electron'
import type {
  GitGraphAction,
  GitGraphActionResult,
  GitGraphAuxRefs
} from '../../../../shared/git-graph-actions'
import { runGitGraphActionWithStashLock } from '../../../git/graph-action-lock'
import { listGraphAuxRefs } from '../../../git/graph-aux-refs'
import { assertWslUncPathRunning } from '../../../wsl/wsl-unc-access-gate'
import { requireReachableGitRoute } from '../../../providers/execution-host-provider-dispatch'
import { getConnectionExecutionHostId } from '../../../../shared/execution-host'
import { GitGraphActionSchema } from '../../../../shared/rpc-contract/git-graph-action-params'
import { failure } from '../../../git/graph-action-result'
import { resolveRegisteredWorktreePath } from '../../registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../../local-worktree-runtime-options'
import type { FilesystemHandlerContext } from '../filesystem-handler-context'

export function registerGitGraphActionHandlers(context: FilesystemHandlerContext): void {
  const { store } = context

  ipcMain.handle(
    'git:graphAction',
    async (
      _event,
      args: { worktreePath: string; action: GitGraphAction; connectionId?: string }
    ): Promise<GitGraphActionResult> => {
      const parsed = GitGraphActionSchema.safeParse(args.action)
      if (!parsed.success) {
        return failure('invalid-input', 'Invalid graph action.')
      }
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      // Do not boot a stopped WSL distro for a graph mutation.
      await assertWslUncPathRunning(args.worktreePath)
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      await assertWslUncPathRunning(worktreePath, gitOptions.wslDistro)
      return runGitGraphActionWithStashLock(worktreePath, parsed.data, gitOptions)
    }
  )

  ipcMain.handle(
    'git:graphAuxRefs',
    async (
      _event,
      args: { worktreePath: string; connectionId?: string }
    ): Promise<GitGraphAuxRefs> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      await assertWslUncPathRunning(args.worktreePath)
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      await assertWslUncPathRunning(worktreePath, gitOptions.wslDistro)
      return listGraphAuxRefs(worktreePath, gitOptions)
    }
  )
}
