export type GitGraphConflictOperation = 'merge' | 'rebase' | 'cherry-pick' | 'revert'

export type GitGraphAction =
  | { kind: 'checkout'; branch: string }
  | { kind: 'createBranch'; name: string; startPoint: string; checkout: boolean }
  | { kind: 'renameBranch'; oldName: string; newName: string }
  | { kind: 'deleteBranch'; name: string; force: boolean }
  | {
      kind: 'createTag'
      name: string
      target: string
      message?: string
      push: boolean
      remote?: string
    }
  | { kind: 'deleteTag'; name: string }
  | { kind: 'pushTag'; name: string; remote?: string }
  | { kind: 'stashCreate'; includeUntracked: boolean; message?: string }
  | { kind: 'stashApply'; index: number; reinstateIndex: boolean }
  | { kind: 'stashPop'; index: number; reinstateIndex: boolean }
  | { kind: 'stashDrop'; index: number }
  | {
      kind: 'merge'
      target: string
      noFastForward: boolean
      squash: boolean
      noCommit: boolean
    }
  | { kind: 'rebase'; onto: string; ignoreDate: boolean }
  | { kind: 'cherryPick'; commit: string; noCommit: boolean; recordOrigin: boolean }
  | { kind: 'revert'; commit: string }
  | { kind: 'reset'; target: string; mode: 'soft' | 'mixed' | 'hard' }
  | { kind: 'dropCommit'; commit: string }
  | { kind: 'restoreBackup'; ref: string }
  | { kind: 'remoteAdd'; name: string; url: string }
  | { kind: 'remoteRemove'; name: string }
  | { kind: 'remoteSetUrl'; name: string; url: string }
  | { kind: 'continueOperation' }
  | { kind: 'skipOperation' }
  | { kind: 'abortOperation' }

export type GitGraphStash = {
  index: number
  oid: string
  message: string
  createdAt: number
}

export type GitGraphBackupRef = {
  ref: string
  oid: string
  createdAt: number
}

export type GitGraphAuxRefs = {
  stashes: GitGraphStash[]
  backups: GitGraphBackupRef[]
}

export type GitGraphActionFailureCode =
  | 'conflict'
  | 'preflight'
  | 'occupied-branch'
  | 'dirty-worktree'
  | 'invalid-input'
  | 'git-error'

export type GitGraphActionResult =
  | { ok: true; backupRef?: string; message?: string }
  | {
      ok: false
      code: GitGraphActionFailureCode
      message: string
      conflict?: GitGraphConflictOperation
      backupRef?: string
    }
