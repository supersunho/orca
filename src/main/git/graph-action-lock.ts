import * as path from 'node:path'
import { resolveGitMetadataPath, resolveWorktreeHostPath } from '../../shared/git-metadata-path'
import { withFileTransactionLock } from '../file-transaction-lock'
import type { GitGraphAction, GitGraphActionResult } from '../../shared/git-graph-actions'
import type { GitRuntimeOptions } from './git-runtime-options'
import { execOptions } from './graph-action-worktree'
import { failure } from './graph-action-result'
import { gitExecFileAsync } from './runner'
import { runGitGraphAction } from './graph-actions'

function isStashMutation(action: GitGraphAction): boolean {
  return action.kind.startsWith('stash')
}

/**
 * Serialize stash actions across Orca processes sharing the repo: Git addresses stash entries by
 * stack index, so concurrent Apply/Create calls would otherwise race the shared stack.
 */
export async function runGitGraphActionWithStashLock(
  worktreePath: string,
  action: GitGraphAction,
  options: GitRuntimeOptions = {}
): Promise<GitGraphActionResult> {
  if (!isStashMutation(action)) {
    return runGitGraphAction(worktreePath, action, options)
  }
  try {
    const { stdout } = await gitExecFileAsync(
      ['rev-parse', '--git-common-dir'],
      execOptions(worktreePath, options)
    )
    const hostWorktreePath =
      resolveWorktreeHostPath(
        worktreePath,
        options.wslDistro ? { wslDistro: options.wslDistro } : {}
      ) ?? worktreePath
    const commonDir =
      resolveGitMetadataPath(
        hostWorktreePath,
        stdout,
        options.wslDistro ? { wslDistro: options.wslDistro } : {}
      ) ?? hostWorktreePath
    return await withFileTransactionLock(path.join(commonDir, 'orca-locks', 'git-stash.lock'), () =>
      runGitGraphAction(worktreePath, action, options)
    )
  } catch (error) {
    return failure(
      'preflight',
      `Could not lock the stash stack before the action: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
