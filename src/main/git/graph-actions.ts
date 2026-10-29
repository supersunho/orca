import { randomUUID } from 'node:crypto'
import type { GitGraphAction, GitGraphActionResult } from '../../shared/git-graph-actions'
import type { GitRuntimeOptions } from './git-runtime-options'
import { extractExecError, gitExecFileAsync } from './runner'
import { runWithGitReadCacheInvalidation } from './source-control/git-read-cache-invalidation'
import { BACKUP_REF_PREFIX, validateAction } from './graph-action-validation'
import { isContinuationAction, needsBackup, runContinuation } from './graph-action-continuation'
import {
  detectGraphConflictOperation,
  execOptions,
  readBranchState,
  runPreflight
} from './graph-action-worktree'
import { buildActionPlan } from './graph-action-plan'
import { formatGitMessage, mapGitFailure } from './graph-action-failure'
import { failure, success, type BackupOutcome } from './graph-action-result'

export async function runGitGraphAction(
  worktreePath: string,
  action: GitGraphAction,
  options: GitRuntimeOptions = {}
): Promise<GitGraphActionResult> {
  if (typeof action !== 'object' || action === null) {
    return failure('invalid-input', 'Missing graph action.')
  }
  const invalid = validateAction(action)
  if (invalid) {
    return failure('invalid-input', invalid)
  }
  if (action.kind === 'stashPop' || action.kind === 'stashDrop') {
    return failure(
      'preflight',
      'Stash pop and drop are unavailable because Git addresses stashes by index; use Apply and drop the stash from a terminal.'
    )
  }

  try {
    if (isContinuationAction(action)) {
      return await runContinuation(worktreePath, action, options)
    }

    const conflict = await detectGraphConflictOperation(worktreePath, options)
    if (conflict !== 'unknown') {
      return failure(
        'preflight',
        `A ${conflict} is already in progress. Continue, skip, or abort it first.`,
        conflict
      )
    }

    const branchState = await readBranchState(worktreePath, options)
    const preflight = await runPreflight(worktreePath, action, branchState, options)
    if (preflight) {
      return preflight
    }

    const plan = await buildActionPlan(worktreePath, action, branchState, options)
    if (plan instanceof Error) {
      return failure('invalid-input', plan.message)
    }

    const backupOutcome: BackupOutcome = needsBackup(action)
      ? await createBackupRef(worktreePath, branchState, options)
      : { ok: true, backup: {} }
    if (!backupOutcome.ok) {
      return failure('preflight', backupOutcome.message)
    }
    const backup = backupOutcome.backup

    try {
      await runWithGitReadCacheInvalidation(async () => {
        for (const command of plan.commands) {
          await gitExecFileAsync(command, execOptions(worktreePath, options, plan.env))
        }
      })
      return success(backup)
    } catch (error) {
      return await mapGitFailure(error, worktreePath, action, options, backup)
    }
  } catch (error) {
    const { stderr } = extractExecError(error)
    return failure('git-error', formatGitMessage(stderr, 'Graph action failed'))
  }
}

async function createBackupRef(
  worktreePath: string,
  branchState: { current: string | null },
  options: GitRuntimeOptions
): Promise<BackupOutcome> {
  const timestamp = Date.now()
  const suffix = randomUUID().slice(0, 8)
  const ref = `${BACKUP_REF_PREFIX}${timestamp}-${safeBranchComponent(branchState.current)}-${suffix}`
  try {
    const { stdout } = await gitExecFileAsync(
      ['rev-parse', '--show-object-format'],
      execOptions(worktreePath, options)
    )
    const zeroOid = '0'.repeat(stdout.trim() === 'sha256' ? 64 : 40)
    await gitExecFileAsync(['update-ref', ref, 'HEAD', zeroOid], execOptions(worktreePath, options))
    return { ok: true, backup: { ref } }
  } catch (error) {
    const { stderr } = extractExecError(error)
    return {
      ok: false,
      message: `Could not create a backup ref before the action: ${formatGitMessage(stderr, 'unknown error')}`
    }
  }
}

function safeBranchComponent(branch: string | null): string {
  const raw = (branch ?? 'detached')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 60)
    .replace(/[.]+$/, '')
  if (raw.length === 0) {
    return 'head'
  }
  return raw.endsWith('.lock') ? `${raw}-ref` : raw
}
