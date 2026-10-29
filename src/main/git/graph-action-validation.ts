import type { GitGraphAction } from '../../shared/git-graph-actions'

const MAX_REF_LENGTH = 255
const MAX_REV_LENGTH = 1024
const MAX_STASH_INDEX = 10_000
const MAX_MESSAGE_LENGTH = 20_000
export const BACKUP_REF_PREFIX = 'refs/orca/backup/'
// eslint-disable-next-line no-control-regex -- Reject control characters before they reach git.
const CONTROL_OR_WHITESPACE = /[\s\x00-\x1f\x7f]/

export function validateAction(action: GitGraphAction): string | null {
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
