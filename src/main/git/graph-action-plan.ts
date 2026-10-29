import type { GitGraphAction } from '../../shared/git-graph-actions'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitExecFileAsync } from './runner'
import { execOptions, type BranchState } from './graph-action-worktree'

const DEFAULT_REMOTE = 'origin'
const FULL_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i

export type ActionPlan = {
  commands: string[][]
  env?: NodeJS.ProcessEnv
}

export async function buildActionPlan(
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
        commands: [stashApplyCommand(action.index, action.reinstateIndex)]
      }
    case 'stashPop':
    case 'stashDrop':
      return new Error('Destructive stash actions are disabled.')
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

function stashApplyCommand(index: number, reinstateIndex: boolean): string[] {
  const command = ['stash', 'apply']
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
