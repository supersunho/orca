import type { GitGraphAuxRefs, GitGraphStash } from '../../shared/git-graph-actions'
import type { GitRuntimeOptions, WorktreeGitExecOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'

function execOptions(worktreePath: string, options: GitRuntimeOptions): WorktreeGitExecOptions {
  return gitOptionsForWorktree(worktreePath, {
    ...options,
    admissionTier: options.admissionTier ?? 'background'
  })
}

function parseStashes(stdout: string): GitGraphStash[] {
  return stdout.split(/\r?\n/).flatMap((line) => {
    const [selector, oid, message, createdAt] = line.split('\0')
    const match = selector?.match(/^stash@\{(\d+)\}$/)
    if (!match || !oid) {
      return []
    }
    const timestamp = Number(createdAt)
    return [
      {
        index: Number(match[1]),
        oid,
        message: message ?? '',
        createdAt: Number.isFinite(timestamp) ? timestamp * 1000 : 0
      }
    ]
  })
}

export async function listGraphAuxRefs(
  worktreePath: string,
  options: GitRuntimeOptions = {}
): Promise<GitGraphAuxRefs> {
  const exec = execOptions(worktreePath, options)
  const [stashResult, backupResult] = await Promise.allSettled([
    gitExecFileAsync(['stash', 'list', '--format=%gd%x00%H%x00%gs%x00%ct'], exec),
    gitExecFileAsync(
      [
        'for-each-ref',
        '--format=%(refname)%00%(objectname)%00%(committerdate:unix)',
        'refs/orca/backup'
      ],
      exec
    )
  ])

  const stashes = stashResult.status === 'fulfilled' ? parseStashes(stashResult.value.stdout) : []
  const backups =
    backupResult.status === 'fulfilled'
      ? backupResult.value.stdout.split(/\r?\n/).flatMap((line) => {
          const [ref, oid, createdAt] = line.split('\0')
          if (!ref || !oid) {
            return []
          }
          const timestamp = Number(createdAt)
          return [
            {
              ref,
              oid,
              createdAt: Number.isFinite(timestamp) ? timestamp * 1000 : 0
            }
          ]
        })
      : []

  return { stashes, backups }
}
