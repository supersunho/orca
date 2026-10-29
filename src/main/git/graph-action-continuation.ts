import type {
  GitGraphAction,
  GitGraphActionResult,
  GitGraphConflictOperation
} from '../../shared/git-graph-actions'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitExecFileAsync } from './runner'
import { runWithGitReadCacheInvalidation } from './source-control/git-read-cache-invalidation'
import {
  detectGraphConflictOperation,
  execOptions,
  hasUnresolvedConflicts
} from './graph-action-worktree'
import { mapGitFailure } from './graph-action-failure'
import { failure } from './graph-action-result'

export function isContinuationAction(
  action: GitGraphAction
): action is Extract<
  GitGraphAction,
  { kind: 'continueOperation' | 'skipOperation' | 'abortOperation' }
> {
  return (
    action.kind === 'continueOperation' ||
    action.kind === 'skipOperation' ||
    action.kind === 'abortOperation'
  )
}

export function needsBackup(action: GitGraphAction): boolean {
  return (
    action.kind === 'merge' ||
    action.kind === 'rebase' ||
    action.kind === 'cherryPick' ||
    action.kind === 'reset' ||
    action.kind === 'dropCommit' ||
    action.kind === 'restoreBackup'
  )
}

export async function runContinuation(
  worktreePath: string,
  action: Extract<
    GitGraphAction,
    { kind: 'continueOperation' | 'skipOperation' | 'abortOperation' }
  >,
  options: GitRuntimeOptions
): Promise<GitGraphActionResult> {
  const conflict = await detectGraphConflictOperation(worktreePath, options)
  if (conflict === 'unknown') {
    return failure(
      'preflight',
      'No merge, rebase, cherry-pick, or revert is in progress in this worktree.'
    )
  }

  const command = continuationCommand(action.kind, conflict)
  if (command instanceof Error) {
    return failure('preflight', command.message)
  }

  if (action.kind === 'continueOperation') {
    const unresolved = await hasUnresolvedConflicts(worktreePath, options)
    if (unresolved) {
      return failure('preflight', 'Resolve all conflicts before continuing.', conflict)
    }
  }

  try {
    await runWithGitReadCacheInvalidation(() =>
      gitExecFileAsync(
        command,
        execOptions(worktreePath, options, { ...process.env, GIT_EDITOR: 'true' })
      )
    )
    return { ok: true }
  } catch (error) {
    return await mapGitFailure(error, worktreePath, action, options, {})
  }
}

const CONTINUE_COMMANDS: Record<GitGraphConflictOperation, string[]> = {
  merge: ['merge', '--continue'],
  rebase: ['rebase', '--continue'],
  'cherry-pick': ['cherry-pick', '--continue'],
  revert: ['revert', '--continue']
}

const ABORT_COMMANDS: Record<GitGraphConflictOperation, string[]> = {
  merge: ['merge', '--abort'],
  rebase: ['rebase', '--abort'],
  'cherry-pick': ['cherry-pick', '--abort'],
  revert: ['revert', '--abort']
}

function continuationCommand(
  kind: 'continueOperation' | 'skipOperation' | 'abortOperation',
  conflict: GitGraphConflictOperation
): string[] | Error {
  if (kind === 'continueOperation') {
    return CONTINUE_COMMANDS[conflict]
  }
  if (kind === 'abortOperation') {
    return ABORT_COMMANDS[conflict]
  }
  if (conflict === 'rebase' || conflict === 'cherry-pick') {
    return [conflict, '--skip']
  }
  return new Error(`Skip is not supported while a ${conflict} is in progress.`)
}
