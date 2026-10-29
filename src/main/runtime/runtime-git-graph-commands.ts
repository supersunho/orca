import type {
  GitGraphAction,
  GitGraphActionResult,
  GitGraphAuxRefs
} from '../../shared/git-graph-actions'
import { requireRuntimeGitProvider, type RuntimeGitCommandHost } from './runtime-git-command-target'

export class RuntimeGitGraphCommands {
  constructor(private readonly host: RuntimeGitCommandHost) {}

  async runRuntimeGitGraphAction(
    worktreeSelector: string,
    action: GitGraphAction
  ): Promise<GitGraphActionResult> {
    const target = await this.host.resolveRuntimeGitTarget(worktreeSelector)
    return requireRuntimeGitProvider(target).runGitGraphAction(target.worktree.path, action)
  }

  async listRuntimeGitGraphAuxRefs(worktreeSelector: string): Promise<GitGraphAuxRefs> {
    const target = await this.host.resolveRuntimeGitTarget(worktreeSelector)
    return requireRuntimeGitProvider(target).listGraphAuxRefs(target.worktree.path)
  }
}
