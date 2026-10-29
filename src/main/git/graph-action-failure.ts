import type {
  GitGraphAction,
  GitGraphActionResult,
  GitGraphConflictOperation
} from '../../shared/git-graph-actions'
import type { GitRuntimeOptions } from './git-runtime-options'
import { stripCredentialsFromMessage } from '../../shared/git-remote-error'
import { extractExecError } from './runner'
import { detectGraphConflictOperation } from './graph-action-worktree'
import { failure, type BackupResult } from './graph-action-result'

const CONFLICT_STDERR =
  /(?:^|\n)(?:CONFLICT|Automatic merge failed|Merge conflict|error: could not apply|After resolving the conflicts|Resolve all conflicts manually|Unmerged paths|fix conflicts and then commit|needs merge|unmerged files|cannot continue because of unmerged files)/i

export async function mapGitFailure(
  error: unknown,
  worktreePath: string,
  action: GitGraphAction,
  options: GitRuntimeOptions,
  backup: BackupResult
): Promise<GitGraphActionResult> {
  const message = formatGitMessage(extractExecError(error).stderr, 'Git command failed')
  const conflict = await detectGraphConflictOperation(worktreePath, options)
  const stderrIndicatesConflict = CONFLICT_STDERR.test(message)
  const impliedOperation = conflictOperationForAction(action.kind)
  const resolvedConflict =
    conflict !== 'unknown' ? conflict : stderrIndicatesConflict ? impliedOperation : null

  if (conflict !== 'unknown' || stderrIndicatesConflict) {
    return failure(
      'conflict',
      withBackupWarning(message, backup.warning),
      resolvedConflict ?? undefined,
      backup.ref
    )
  }
  return failure('git-error', withBackupWarning(message, backup.warning), undefined, backup.ref)
}

function conflictOperationForAction(
  kind: GitGraphAction['kind']
): GitGraphConflictOperation | null {
  switch (kind) {
    case 'merge':
      return 'merge'
    case 'rebase':
      return 'rebase'
    case 'cherryPick':
      return 'cherry-pick'
    case 'revert':
      return 'revert'
    case 'dropCommit':
      return 'rebase'
    case 'checkout':
    case 'createBranch':
    case 'renameBranch':
    case 'deleteBranch':
    case 'createTag':
    case 'deleteTag':
    case 'pushTag':
    case 'stashCreate':
    case 'stashApply':
    case 'stashPop':
    case 'stashDrop':
    case 'reset':
    case 'restoreBackup':
    case 'remoteAdd':
    case 'remoteRemove':
    case 'remoteSetUrl':
    case 'continueOperation':
    case 'skipOperation':
    case 'abortOperation':
      return null
  }
}

function withBackupWarning(message: string, warning: string | undefined): string {
  return warning ? `${message}\n${warning}` : message
}

export function formatGitMessage(message: string, fallback: string): string {
  const cleaned = stripCredentialsFromMessage(message).trim()
  if (cleaned.length === 0) {
    return fallback
  }
  return cleaned.length > 4000 ? cleaned.slice(0, 4000) : cleaned
}
