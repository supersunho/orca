import { ipcMain } from 'electron'
import type {
  GitBranchCompareResult,
  GitCommitCompareResult,
  GitCommitRangeCompareResult
} from '../../../../shared/git-diff-compare-types'
import { getBranchCompare, getCommitCompare, getCommitRangeCompare } from '../../../git/status'
import { resolveRegisteredWorktreePath } from '../../registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../../local-worktree-runtime-options'
import { validateFullGitObjectId } from '../filesystem-path-containment'
import type { FilesystemHandlerContext } from '../filesystem-handler-context'
import type { GitAdmissionTier } from '../../../git/command-runner/git-exec-options'
import { requireReachableGitRoute } from '../../../providers/execution-host-provider-dispatch'
import { getConnectionExecutionHostId } from '../../../../shared/execution-host'
import { assertWslUncPathRunning } from '../../../wsl/wsl-unc-access-gate'

export function registerGitRemoteCompareHandlers(context: FilesystemHandlerContext): void {
  const { store } = context

  ipcMain.handle(
    'git:branchCompare',
    async (
      _event,
      args: {
        worktreePath: string
        baseRef: string
        connectionId?: string
        admissionTier?: GitAdmissionTier
      }
    ): Promise<GitBranchCompareResult> => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      // A 30 s poll while Source Control shows the branch: its Git would boot a stopped WSL distro (E9).
      await assertWslUncPathRunning(args.worktreePath)
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      await assertWslUncPathRunning(worktreePath, gitOptions.wslDistro)
      return getBranchCompare(worktreePath, args.baseRef, {
        ...gitOptions,
        ...(args.admissionTier ? { admissionTier: args.admissionTier } : {})
      })
    }
  )

  ipcMain.handle(
    'git:commitCompare',
    async (
      _event,
      args: { worktreePath: string; commitId: string; connectionId?: string }
    ): Promise<GitCommitCompareResult> => {
      const commitId = validateFullGitObjectId(args.commitId, 'commitId')
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return getCommitCompare(worktreePath, commitId, gitOptions)
    }
  )

  ipcMain.handle(
    'git:commitRangeCompare',
    async (
      _event,
      args: { worktreePath: string; baseOid: string; headOid: string; connectionId?: string }
    ): Promise<GitCommitRangeCompareResult> => {
      const baseOid = validateFullGitObjectId(args.baseOid, 'baseOid')
      const headOid = validateFullGitObjectId(args.headOid, 'headOid')
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return getCommitRangeCompare(worktreePath, baseOid, headOid, gitOptions)
    }
  )
}
