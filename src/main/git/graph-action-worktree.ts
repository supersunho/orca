import { access } from 'node:fs/promises'
import * as path from 'node:path'
import type {
  GitGraphAction,
  GitGraphActionResult,
  GitGraphConflictOperation
} from '../../shared/git-graph-actions'
import { parseWorktreeList } from '../../shared/git-worktree-porcelain-parser'
import { resolveWorktreeHostPath } from '../../shared/git-metadata-path'
import type { GitRuntimeOptions, WorktreeGitExecOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'
import { detectConflictOperation } from './status'
import { resolveGitDir } from './source-control/resolve-git-dir'
import { failure } from './graph-action-result'

export type ConflictOperation = GitGraphConflictOperation | 'unknown'
export type BranchState = { current: string | null }

export function execOptions(
  worktreePath: string,
  options: GitRuntimeOptions,
  env?: NodeJS.ProcessEnv
): WorktreeGitExecOptions & { env?: NodeJS.ProcessEnv } {
  return {
    ...gitOptionsForWorktree(worktreePath, {
      ...options,
      admissionTier: options.admissionTier ?? 'interactive'
    }),
    ...(env ? { env } : {})
  }
}

export async function detectGraphConflictOperation(
  worktreePath: string,
  options: GitRuntimeOptions
): Promise<ConflictOperation> {
  const detected = await detectConflictOperation(
    worktreePath,
    options.wslDistro ? { wslDistro: options.wslDistro } : {}
  ).catch((): 'unknown' => 'unknown')
  if (detected === 'merge' || detected === 'rebase' || detected === 'cherry-pick') {
    return detected
  }
  return (await hasRevertHead(worktreePath, options)) ? 'revert' : 'unknown'
}

async function hasRevertHead(worktreePath: string, options: GitRuntimeOptions): Promise<boolean> {
  try {
    const gitDir = await resolveGitDir(
      worktreePath,
      options.wslDistro ? { wslDistro: options.wslDistro } : {}
    )
    await access(path.join(gitDir, 'REVERT_HEAD'))
    return true
  } catch {
    return false
  }
}

export async function hasUnresolvedConflicts(
  worktreePath: string,
  options: GitRuntimeOptions
): Promise<boolean> {
  try {
    const { stdout } = await gitExecFileAsync(
      ['diff', '--name-only', '--diff-filter=U'],
      execOptions(worktreePath, options)
    )
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

export async function readBranchState(
  worktreePath: string,
  options: GitRuntimeOptions
): Promise<BranchState> {
  try {
    const { stdout } = await gitExecFileAsync(
      ['symbolic-ref', '--quiet', '--short', 'HEAD'],
      execOptions(worktreePath, options)
    )
    const current = stdout.trim()
    return { current: current.length > 0 ? current : null }
  } catch {
    return { current: null }
  }
}

export async function runPreflight(
  worktreePath: string,
  action: GitGraphAction,
  branchState: BranchState,
  options: GitRuntimeOptions
): Promise<GitGraphActionResult | null> {
  switch (action.kind) {
    case 'checkout': {
      if (branchState.current === action.branch) {
        return null
      }
      const occupied = await findOccupyingWorktree(worktreePath, action.branch, options)
      if (occupied) {
        return occupiedFailure(action.branch, occupied)
      }
      return (await isWorktreeDirty(worktreePath, options))
        ? failure(
            'dirty-worktree',
            'The working tree has uncommitted changes. Stash or commit them before switching branches.'
          )
        : null
    }
    case 'renameBranch': {
      if (action.oldName === branchState.current) {
        return null
      }
      const occupied = await findOccupyingWorktree(worktreePath, action.oldName, options)
      return occupied ? occupiedFailure(action.oldName, occupied) : null
    }
    case 'deleteBranch': {
      if (action.name === branchState.current) {
        return failure('preflight', 'Cannot delete the branch checked out in this worktree.')
      }
      const occupied = await findOccupyingWorktree(worktreePath, action.name, options)
      return occupied ? occupiedFailure(action.name, occupied) : null
    }
    case 'merge':
    case 'rebase':
    case 'reset':
    case 'cherryPick':
    case 'revert':
    case 'restoreBackup':
      return (await isWorktreeDirty(worktreePath, options))
        ? failure(
            'dirty-worktree',
            'The working tree has uncommitted changes. Stash or commit them before continuing.'
          )
        : null
    case 'dropCommit':
      if (!branchState.current) {
        return failure('preflight', 'Cannot drop a commit from a detached HEAD.')
      }
      return (await isWorktreeDirty(worktreePath, options))
        ? failure(
            'dirty-worktree',
            'The working tree has uncommitted changes. Stash or commit them before continuing.'
          )
        : null
    case 'createBranch':
      if (!action.checkout) {
        return null
      }
      return (await isWorktreeDirty(worktreePath, options))
        ? failure(
            'dirty-worktree',
            'The working tree has uncommitted changes. Stash or commit them before switching branches.'
          )
        : null
    case 'createTag':
    case 'deleteTag':
    case 'pushTag':
    case 'stashCreate':
    case 'stashApply':
    case 'stashPop':
    case 'stashDrop':
    case 'remoteAdd':
    case 'remoteRemove':
    case 'remoteSetUrl':
    case 'continueOperation':
    case 'skipOperation':
    case 'abortOperation':
      return null
  }
}

function occupiedFailure(branch: string, worktree: string): GitGraphActionResult {
  return failure(
    'occupied-branch',
    `Branch "${branch}" is checked out in another worktree (${worktree}).`
  )
}

async function isWorktreeDirty(worktreePath: string, options: GitRuntimeOptions): Promise<boolean> {
  const { stdout } = await gitExecFileAsync(
    ['status', '--porcelain'],
    execOptions(worktreePath, options)
  )
  return stdout.trim().length > 0
}

async function findOccupyingWorktree(
  worktreePath: string,
  branch: string,
  options: GitRuntimeOptions
): Promise<string | null> {
  const { stdout } = await gitExecFileAsync(
    ['worktree', 'list', '--porcelain', '-z'],
    execOptions(worktreePath, options)
  )
  const ref = `refs/heads/${branch}`
  for (const entry of parseWorktreeList(stdout, { nulDelimited: true })) {
    if (entry.branch === ref && !sameWorktreePath(entry.path, worktreePath, options)) {
      return entry.path
    }
  }
  return null
}

function sameWorktreePath(left: string, right: string, options: GitRuntimeOptions): boolean {
  const metadataOptions = options.wslDistro ? { wslDistro: options.wslDistro } : {}
  const a = path.resolve(resolveWorktreeHostPath(left, metadataOptions) ?? left)
  const b = path.resolve(resolveWorktreeHostPath(right, metadataOptions) ?? right)
  return process.platform === 'win32' || process.platform === 'darwin'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b
}
