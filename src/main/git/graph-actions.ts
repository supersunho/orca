/* eslint-disable max-lines -- Why: one typed dispatcher keeps validation, preflight, backup, and conflict mapping on the same safety path. */
import { access } from 'node:fs/promises'
import * as path from 'node:path'
import type {
  GitGraphAction,
  GitGraphActionFailureCode,
  GitGraphActionResult,
  GitGraphConflictOperation
} from '../../shared/git-graph-actions'
import { stripCredentialsFromMessage } from '../../shared/git-remote-error'
import { parseWorktreeList } from '../../shared/git-worktree-porcelain-parser'
import { resolveWorktreeHostPath } from '../../shared/git-metadata-path'
import type { GitRuntimeOptions, WorktreeGitExecOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { extractExecError, gitExecFileAsync } from './runner'
import { detectConflictOperation } from './status'
import { resolveGitDir } from './source-control/resolve-git-dir'
import { runWithGitReadCacheInvalidation } from './source-control/git-read-cache-invalidation'

type ConflictOperation = GitGraphConflictOperation | 'unknown'

const MAX_REF_LENGTH = 255
const MAX_REV_LENGTH = 1024
const MAX_STASH_INDEX = 10_000
const MAX_MESSAGE_LENGTH = 20_000
const DEFAULT_REMOTE = 'origin'
const BACKUP_REF_PREFIX = 'refs/orca/backup/'
// eslint-disable-next-line no-control-regex -- Reject control characters before they reach git.
const CONTROL_OR_WHITESPACE = /[\s\x00-\x1f\x7f]/
const FULL_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i
const CONFLICT_STDERR =
  /(?:^|\n)(?:CONFLICT|Automatic merge failed|Merge conflict|error: could not apply|After resolving the conflicts|Resolve all conflicts manually|Unmerged paths|fix conflicts and then commit|needs merge|unmerged files|cannot continue because of unmerged files)/i

type BranchState = { current: string | null }

type ActionPlan = {
  commands: string[][]
  env?: NodeJS.ProcessEnv
}

type BackupResult = { ref?: string; warning?: string }

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

    const backup = needsBackup(action)
      ? await createBackupRef(worktreePath, branchState, options)
      : {}

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

function success(backup: BackupResult): GitGraphActionResult {
  if (backup.warning) {
    return { ok: true, message: backup.warning, ...(backup.ref ? { backupRef: backup.ref } : {}) }
  }
  return { ok: true, ...(backup.ref ? { backupRef: backup.ref } : {}) }
}

function failure(
  code: GitGraphActionFailureCode,
  message: string,
  conflict?: GitGraphConflictOperation,
  backupRef?: string
): GitGraphActionResult {
  return {
    ok: false,
    code,
    message,
    ...(conflict ? { conflict } : {}),
    ...(backupRef ? { backupRef } : {})
  }
}

function isContinuationAction(
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

function needsBackup(action: GitGraphAction): boolean {
  return (
    action.kind === 'merge' ||
    action.kind === 'rebase' ||
    action.kind === 'cherryPick' ||
    action.kind === 'reset' ||
    action.kind === 'dropCommit' ||
    action.kind === 'restoreBackup'
  )
}

function execOptions(
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

function validateAction(action: GitGraphAction): string | null {
  switch (action.kind) {
    case 'checkout':
      return validateBranchSyntax(action.branch, 'branch')
    case 'createBranch':
      return (
        validateBranchSyntax(action.name, 'branch name') ??
        validateRevisionSyntax(action.startPoint, 'start point')
      )
    case 'renameBranch': {
      const oldName = validateBranchSyntax(action.oldName, 'branch name')
      if (oldName) {
        return oldName
      }
      const newName = validateBranchSyntax(action.newName, 'branch name')
      if (newName) {
        return newName
      }
      return action.oldName === action.newName ? 'The new branch name matches the old name.' : null
    }
    case 'deleteBranch':
      return validateBranchSyntax(action.name, 'branch name')
    case 'createTag': {
      const name = validateTagSyntax(action.name, 'tag name')
      if (name) {
        return name
      }
      const target = validateRevisionSyntax(action.target, 'tag target')
      if (target) {
        return target
      }
      const message = validateMessage(action.message, 'tag message')
      if (message) {
        return message
      }
      return action.remote === undefined ? null : validateRemoteSyntax(action.remote, 'remote')
    }
    case 'deleteTag':
      return validateTagSyntax(action.name, 'tag name')
    case 'pushTag': {
      const name = validateTagSyntax(action.name, 'tag name')
      if (name) {
        return name
      }
      return action.remote === undefined ? null : validateRemoteSyntax(action.remote, 'remote')
    }
    case 'stashCreate':
      return validateMessage(action.message, 'stash message')
    case 'stashApply':
    case 'stashPop':
      return validateStashIndex(action.index)
    case 'stashDrop':
      return validateStashIndex(action.index)
    case 'merge':
      return validateRevisionSyntax(action.target, 'merge target')
    case 'rebase':
      return validateRevisionSyntax(action.onto, 'rebase target')
    case 'cherryPick':
    case 'revert':
      return validateRevisionSyntax(action.commit, 'commit')
    case 'reset': {
      const target = validateRevisionSyntax(action.target, 'reset target')
      if (target) {
        return target
      }
      return action.mode === 'soft' || action.mode === 'mixed' || action.mode === 'hard'
        ? null
        : 'Invalid reset mode.'
    }
    case 'restoreBackup': {
      if (!action.ref.startsWith(BACKUP_REF_PREFIX) || hasUnsafeRefChars(action.ref)) {
        return 'Invalid backup ref.'
      }
      return null
    }
    case 'dropCommit':
      return validateRevisionSyntax(action.commit, 'commit')
    case 'remoteAdd':
    case 'remoteSetUrl': {
      const name = validateRemoteName(action.name)
      if (name) {
        return name
      }
      return validateRemoteUrl(action.url)
    }
    case 'remoteRemove':
      return validateRemoteName(action.name)
    case 'continueOperation':
    case 'skipOperation':
    case 'abortOperation':
      return null
  }
}

function hasUnsafeRefChars(value: unknown): boolean {
  return (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_REF_LENGTH ||
    value.startsWith('-') ||
    CONTROL_OR_WHITESPACE.test(value) ||
    value.includes('..') ||
    value.includes('@{')
  )
}

function validateBranchSyntax(value: string, label: string): string | null {
  if (hasUnsafeRefChars(value)) {
    return `Invalid ${label}: "${value}".`
  }
  if (
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.endsWith('.') ||
    value.endsWith('.lock') ||
    value.includes('//')
  ) {
    return `Invalid ${label}: "${value}".`
  }
  return null
}

function validateTagSyntax(value: string, label: string): string | null {
  return validateBranchSyntax(value, label)
}

function validateRemoteSyntax(value: string, label: string): string | null {
  if (
    hasUnsafeRefChars(value) ||
    value.endsWith('.lock') ||
    value.endsWith('.') ||
    value.endsWith('/') ||
    value.includes('//') ||
    value.includes(':') ||
    value.includes('~') ||
    value.includes('^') ||
    value.includes('?') ||
    value.includes('*') ||
    value.includes('[') ||
    value.includes('\\')
  ) {
    return `Invalid ${label}: "${value}".`
  }
  return null
}

function validateRemoteName(value: string): string | null {
  return validateRemoteSyntax(value, 'remote name')
}

function validateRemoteUrl(value: string): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2048 ||
    value.startsWith('-') ||
    CONTROL_OR_WHITESPACE.test(value)
  ) {
    return `Invalid remote URL: "${value}".`
  }
  return null
}

function validateRevisionSyntax(value: unknown, label: string): string | null {
  if (typeof value !== 'string') {
    return `Invalid ${label}.`
  }
  if (
    value.length === 0 ||
    value.length > MAX_REV_LENGTH ||
    value.startsWith('-') ||
    CONTROL_OR_WHITESPACE.test(value) ||
    value.includes('..') ||
    value.includes('@{') ||
    value.includes(':') ||
    value.includes('?') ||
    value.includes('*') ||
    value.includes('[') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.endsWith('.lock')
  ) {
    return `Invalid ${label}: "${value}".`
  }
  return null
}

function validateStashIndex(index: number): string | null {
  if (!Number.isInteger(index) || index < 0 || index > MAX_STASH_INDEX) {
    return `Invalid stash index: ${String(index)}.`
  }
  return null
}

function validateMessage(value: unknown, label: string): string | null {
  if (value === undefined) {
    return null
  }
  return typeof value === 'string' && value.length <= MAX_MESSAGE_LENGTH
    ? null
    : `Invalid ${label}.`
}

async function runContinuation(
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

async function detectGraphConflictOperation(
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

async function hasUnresolvedConflicts(
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

async function readBranchState(
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

async function runPreflight(
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

async function createBackupRef(
  worktreePath: string,
  branchState: BranchState,
  options: GitRuntimeOptions
): Promise<BackupResult> {
  const timestamp = Date.now()
  const ref = `${BACKUP_REF_PREFIX}${timestamp}-${safeBranchComponent(branchState.current)}`
  try {
    await gitExecFileAsync(['update-ref', ref, 'HEAD'], execOptions(worktreePath, options))
    return { ref }
  } catch (error) {
    const { stderr } = extractExecError(error)
    const detail = formatGitMessage(stderr, 'unknown error')
    return {
      warning: `The action can continue, but the backup ref could not be created: ${detail}`
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

async function buildActionPlan(
  worktreePath: string,
  action: GitGraphAction,
  branchState: BranchState,
  options: GitRuntimeOptions
): Promise<ActionPlan | Error> {
  switch (action.kind) {
    case 'checkout': {
      if (
        !FULL_OBJECT_ID.test(action.branch) &&
        !(await validateBranchWithGit(worktreePath, action.branch, options))
      ) {
        return new Error(`Invalid branch: "${action.branch}".`)
      }
      return { commands: [['checkout', action.branch, '--']] }
    }
    case 'createBranch': {
      if (
        !(await validateBranchWithGit(worktreePath, action.name, options)) ||
        !(await validateRevisionWithGit(worktreePath, action.startPoint, options))
      ) {
        return new Error('The branch name or start point is not valid.')
      }
      return {
        commands: [
          action.checkout
            ? ['checkout', '-b', action.name, action.startPoint, '--']
            : ['branch', action.name, action.startPoint]
        ]
      }
    }
    case 'renameBranch': {
      if (
        !(await validateBranchWithGit(worktreePath, action.oldName, options)) ||
        !(await validateBranchWithGit(worktreePath, action.newName, options))
      ) {
        return new Error('The branch name is not valid.')
      }
      return action.oldName === branchState.current
        ? { commands: [['branch', '-m', action.newName]] }
        : { commands: [['branch', '-m', action.oldName, action.newName]] }
    }
    case 'deleteBranch': {
      if (!(await validateBranchWithGit(worktreePath, action.name, options))) {
        return new Error(`Invalid branch name: "${action.name}".`)
      }
      return { commands: [['branch', action.force ? '-D' : '-d', action.name]] }
    }
    case 'createTag': {
      if (!(await validateTagWithGit(worktreePath, action.name, options))) {
        return new Error(`Invalid tag name: "${action.name}".`)
      }
      const commands: string[][] =
        action.message === undefined
          ? [['tag', action.name, action.target]]
          : [['tag', '-a', action.name, '-m', action.message, action.target]]
      if (action.push) {
        commands.push(['push', action.remote ?? DEFAULT_REMOTE, `refs/tags/${action.name}`])
      }
      return { commands }
    }
    case 'deleteTag':
      return { commands: [['tag', '-d', action.name]] }
    case 'pushTag':
      return {
        commands: [['push', action.remote ?? DEFAULT_REMOTE, `refs/tags/${action.name}`]]
      }
    case 'stashCreate': {
      const command = ['stash', 'push']
      if (action.includeUntracked) {
        command.push('-u')
      }
      if (action.message !== undefined) {
        command.push('-m', action.message)
      }
      return { commands: [command] }
    }
    case 'stashApply':
      return {
        commands: [stashCommand('apply', action.index, action.reinstateIndex)]
      }
    case 'stashPop':
      return {
        commands: [stashCommand('pop', action.index, action.reinstateIndex)]
      }
    case 'stashDrop':
      return { commands: [['stash', 'drop', `stash@{${action.index}}`]] }
    case 'merge': {
      const command = ['merge']
      if (action.noFastForward) {
        command.push('--no-ff')
      }
      if (action.squash) {
        command.push('--squash')
      }
      if (action.noCommit) {
        command.push('--no-commit')
      }
      command.push(action.target)
      return { commands: [command] }
    }
    case 'rebase': {
      const command = ['rebase']
      if (action.ignoreDate) {
        command.push('--ignore-date')
      }
      command.push(action.onto)
      return { commands: [command] }
    }
    case 'cherryPick': {
      const command = ['cherry-pick']
      if (action.noCommit) {
        command.push('--no-commit')
      }
      if (action.recordOrigin) {
        command.push('-x')
      }
      command.push(action.commit)
      return { commands: [command] }
    }
    case 'revert':
      return { commands: [['revert', '--no-edit', action.commit]] }
    case 'reset':
      return {
        commands: [
          [
            'reset',
            action.mode === 'soft' ? '--soft' : action.mode === 'mixed' ? '--mixed' : '--hard',
            action.target
          ]
        ]
      }
    case 'restoreBackup':
      return { commands: [['reset', '--hard', action.ref]] }
    case 'dropCommit': {
      const { stdout } = await gitExecFileAsync(
        ['rev-list', '--parents', '-n', '1', action.commit],
        execOptions(worktreePath, options)
      )
      const [commitOid, ...parents] = stdout.trim().split(/\s+/)
      if (!commitOid) {
        return new Error('The commit could not be resolved.')
      }
      if (parents.length === 0) {
        return new Error('Cannot drop a root commit.')
      }
      if (parents.length > 1) {
        return new Error('Cannot drop a merge commit.')
      }
      try {
        await gitExecFileAsync(
          ['merge-base', '--is-ancestor', commitOid, 'HEAD'],
          execOptions(worktreePath, options)
        )
      } catch {
        return new Error('The commit is not on the current branch.')
      }
      const head = await gitExecFileAsync(['rev-parse', 'HEAD'], execOptions(worktreePath, options))
      return commitOid === head.stdout.trim()
        ? { commands: [['reset', '--mixed', parents[0]]] }
        : { commands: [['rebase', '--onto', parents[0], commitOid]] }
    }
    case 'remoteAdd':
      return { commands: [['remote', 'add', action.name, action.url]] }
    case 'remoteRemove':
      return { commands: [['remote', 'remove', action.name]] }
    case 'remoteSetUrl':
      return { commands: [['remote', 'set-url', action.name, action.url]] }
    case 'continueOperation':
    case 'skipOperation':
    case 'abortOperation':
      return new Error('Continuation actions must be resolved against the operation in progress.')
  }
}

function stashCommand(action: 'apply' | 'pop', index: number, reinstateIndex: boolean): string[] {
  const command = ['stash', action]
  if (reinstateIndex) {
    command.push('--index')
  }
  command.push(`stash@{${index}}`)
  return command
}

async function validateBranchWithGit(
  worktreePath: string,
  branch: string,
  options: GitRuntimeOptions
): Promise<boolean> {
  try {
    await gitExecFileAsync(
      ['check-ref-format', '--branch', branch],
      execOptions(worktreePath, options)
    )
    return true
  } catch {
    return false
  }
}

async function validateTagWithGit(
  worktreePath: string,
  tag: string,
  options: GitRuntimeOptions
): Promise<boolean> {
  try {
    await gitExecFileAsync(
      ['check-ref-format', `refs/tags/${tag}`],
      execOptions(worktreePath, options)
    )
    return true
  } catch {
    return false
  }
}

async function validateRevisionWithGit(
  worktreePath: string,
  revision: string,
  options: GitRuntimeOptions
): Promise<boolean> {
  try {
    await gitExecFileAsync(
      ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`],
      execOptions(worktreePath, options)
    )
    return true
  } catch {
    return false
  }
}

async function mapGitFailure(
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

function formatGitMessage(message: string, fallback: string): string {
  const cleaned = stripCredentialsFromMessage(message).trim()
  if (cleaned.length === 0) {
    return fallback
  }
  return cleaned.length > 4000 ? cleaned.slice(0, 4000) : cleaned
}
