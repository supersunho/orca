import type {
  GitGraphAction,
  GitGraphActionResult,
  GitGraphAuxRefs
} from '../../../shared/git-graph-actions'
import { resolveLocalWorktreePath, type RuntimeGitContext } from './runtime-git-client-context'
import { callRuntimeRpc } from './runtime-rpc-client'
import { toRuntimeWorktreeSelector } from './runtime-worktree-selector'

export async function runRuntimeGitGraphAction(
  context: RuntimeGitContext,
  action: GitGraphAction
): Promise<GitGraphActionResult> {
  const target = context.target
  if (target.kind === 'local' || !context.worktreeId) {
    return window.api.git.graphAction({
      worktreePath: resolveLocalWorktreePath(context),
      connectionId: context.connectionId,
      action
    })
  }
  return callRuntimeRpc<GitGraphActionResult>(
    target,
    'git.graphAction',
    { worktree: toRuntimeWorktreeSelector(context.worktreeId), action },
    { timeoutMs: 30_000 }
  )
}

export async function getRuntimeGitGraphAuxRefs(
  context: RuntimeGitContext
): Promise<GitGraphAuxRefs> {
  const target = context.target
  if (target.kind === 'local' || !context.worktreeId) {
    return window.api.git.graphAuxRefs({
      worktreePath: resolveLocalWorktreePath(context),
      connectionId: context.connectionId
    })
  }
  return callRuntimeRpc<GitGraphAuxRefs>(
    target,
    'git.graphAuxRefs',
    { worktree: toRuntimeWorktreeSelector(context.worktreeId) },
    { timeoutMs: 15_000 }
  )
}
