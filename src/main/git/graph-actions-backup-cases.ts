import type { GitGraphAction } from '../../shared/git-graph-actions'

export const backupCases: GitGraphAction[] = [
  {
    kind: 'merge',
    target: 'main',
    noFastForward: false,
    squash: false,
    noCommit: false
  },
  { kind: 'rebase', onto: 'main', ignoreDate: false },
  {
    kind: 'cherryPick',
    commit: 'abc123',
    noCommit: false,
    recordOrigin: false
  },
  { kind: 'revert', commit: 'abc123' },
  { kind: 'reset', target: 'HEAD~1', mode: 'hard' }
]

export type BackupFailureCase = {
  name: string
  action: GitGraphAction
  forbiddenCommand: string
}

export const backupFailureCases: BackupFailureCase[] = [
  {
    name: 'merge',
    action: {
      kind: 'merge',
      target: 'main',
      noFastForward: false,
      squash: false,
      noCommit: false
    },
    forbiddenCommand: 'merge'
  },
  {
    name: 'rebase',
    action: { kind: 'rebase', onto: 'main', ignoreDate: false },
    forbiddenCommand: 'rebase'
  },
  {
    name: 'cherry-pick',
    action: { kind: 'cherryPick', commit: 'abc123', noCommit: false, recordOrigin: false },
    forbiddenCommand: 'cherry-pick'
  },
  { name: 'revert', action: { kind: 'revert', commit: 'abc123' }, forbiddenCommand: 'revert' },
  {
    name: 'reset',
    action: { kind: 'reset', target: 'HEAD~1', mode: 'hard' },
    forbiddenCommand: 'reset'
  },
  {
    name: 'drop-commit',
    action: { kind: 'dropCommit', commit: 'abc123' },
    forbiddenCommand: 'reset'
  },
  {
    name: 'restore-backup',
    action: { kind: 'restoreBackup', ref: 'refs/orca/backup/1-main' },
    forbiddenCommand: 'reset'
  }
]
