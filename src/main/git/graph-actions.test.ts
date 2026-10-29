import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitGraphAction } from '../../shared/git-graph-actions'
import type * as RunnerModule from './runner'
import { runGitGraphAction } from './graph-actions'
import { backupCases, backupFailureCases } from './graph-actions-backup.test-fixture'
import { gitExecFileAsync } from './runner'

vi.mock('./runner', async (importOriginal) => {
  const actual = await importOriginal<typeof RunnerModule>()
  return { ...actual, gitExecFileAsync: vi.fn() }
})

const git = vi.mocked(gitExecFileAsync)

type GitReply = { stdout: string; stderr: string }
type GitHandler = (args: string[]) => GitReply | Promise<GitReply>

type MatrixCase = {
  name: string
  action: GitGraphAction
  expected: string[][]
  currentBranch?: string
  status?: string
  worktreeList?: string
}

const PREFLIGHT_COMMANDS: Record<string, true> = {
  'check-ref-format': true,
  'symbolic-ref': true,
  status: true,
  worktree: true,
  'update-ref': true,
  'rev-parse': true,
  'rev-list': true,
  'merge-base': true,
  diff: true
}

let worktree = ''
const calls: string[][] = []

function ok(stdout = ''): GitReply {
  return { stdout, stderr: '' }
}

const TEST_HEAD_OID = 'a'.repeat(40)

function isBackupHeadQuery(args: string[]): boolean {
  return args[0] === 'rev-parse' && args[1] === '--verify' && args[2] === 'HEAD^{commit}'
}

function execError(stderr: string): Error & { stderr: string } {
  return Object.assign(new Error(stderr), { stderr })
}

function installGitHandler(handler?: GitHandler): void {
  git.mockImplementation(async (args) => {
    calls.push(args)
    if (handler) {
      const reply = await handler(args)
      if (reply) {
        return reply
      }
    }
    switch (args[0]) {
      case 'check-ref-format':
      case 'update-ref':
        return ok()
      case 'symbolic-ref':
        return ok('main\n')
      case 'status':
      case 'diff':
        return ok()
      case 'worktree':
        return ok()
      case 'rev-parse':
        return args[1] === '--verify' && args[2] === 'HEAD^{commit}'
          ? ok(`${'a'.repeat(40)}\n`)
          : ok('abc123\n')
      default:
        return ok()
    }
  })
}

function actionCalls(): string[][] {
  return calls.filter((args) => PREFLIGHT_COMMANDS[args[0]] !== true)
}

beforeEach(async () => {
  worktree = await mkdtemp(join(tmpdir(), 'orca-graph-actions-'))
  calls.length = 0
  git.mockReset()
  installGitHandler()
})

afterEach(async () => {
  await rm(worktree, { recursive: true, force: true })
})

describe('runGitGraphAction argv', () => {
  const cases: MatrixCase[] = [
    {
      name: 'checkout',
      action: { kind: 'checkout', branch: 'feature/x' },
      expected: [['checkout', 'feature/x', '--']]
    },
    {
      name: 'createBranch with checkout',
      action: {
        kind: 'createBranch',
        name: 'feature/x',
        startPoint: 'HEAD',
        checkout: true
      },
      expected: [['checkout', '-b', 'feature/x', 'HEAD', '--']]
    },
    {
      name: 'createBranch without checkout',
      action: {
        kind: 'createBranch',
        name: 'feature/x',
        startPoint: 'origin/main',
        checkout: false
      },
      expected: [['branch', 'feature/x', 'origin/main']]
    },
    {
      name: 'renameBranch for another branch',
      action: { kind: 'renameBranch', oldName: 'old', newName: 'new' },
      expected: [['branch', '-m', 'old', 'new']]
    },
    {
      name: 'renameBranch for the current branch',
      action: { kind: 'renameBranch', oldName: 'main', newName: 'trunk' },
      expected: [['branch', '-m', 'trunk']]
    },
    {
      name: 'deleteBranch with force',
      action: { kind: 'deleteBranch', name: 'old', force: true },
      expected: [['branch', '-D', 'old']]
    },
    {
      name: 'deleteBranch without force',
      action: { kind: 'deleteBranch', name: 'old', force: false },
      expected: [['branch', '-d', 'old']]
    },
    {
      name: 'createTag',
      action: {
        kind: 'createTag',
        name: 'v1.0.0',
        target: 'HEAD',
        push: false
      },
      expected: [['tag', 'v1.0.0', 'HEAD']]
    },
    {
      name: 'createTag with an annotated message and push',
      action: {
        kind: 'createTag',
        name: 'v1.0.0',
        target: 'abc123',
        message: 'release',
        push: true,
        remote: 'upstream'
      },
      expected: [
        ['tag', '-a', 'v1.0.0', '-m', 'release', 'abc123'],
        ['push', 'upstream', 'refs/tags/v1.0.0']
      ]
    },
    {
      name: 'deleteTag',
      action: { kind: 'deleteTag', name: 'v1.0.0' },
      expected: [['tag', '-d', 'v1.0.0']]
    },
    {
      name: 'pushTag defaults to origin',
      action: { kind: 'pushTag', name: 'v1.0.0' },
      expected: [['push', 'origin', 'refs/tags/v1.0.0']]
    },
    {
      name: 'stashCreate',
      action: { kind: 'stashCreate', includeUntracked: true, message: 'wip' },
      expected: [['stash', 'push', '-u', '-m', 'wip']]
    },
    {
      name: 'stashCreate without options',
      action: { kind: 'stashCreate', includeUntracked: false },
      expected: [['stash', 'push']]
    },
    {
      name: 'stashApply',
      action: { kind: 'stashApply', index: 2, reinstateIndex: true },
      expected: [['stash', 'apply', '--index', 'stash@{2}']]
    },
    {
      name: 'merge with no-ff',
      action: {
        kind: 'merge',
        target: 'main',
        noFastForward: true,
        squash: false,
        noCommit: false
      },
      expected: [['merge', '--no-ff', 'main']]
    },
    {
      name: 'merge with squash',
      action: {
        kind: 'merge',
        target: 'main',
        noFastForward: false,
        squash: true,
        noCommit: false
      },
      expected: [['merge', '--squash', 'main']]
    },
    {
      name: 'merge with no-commit',
      action: {
        kind: 'merge',
        target: 'main',
        noFastForward: false,
        squash: false,
        noCommit: true
      },
      expected: [['merge', '--no-commit', 'main']]
    },
    {
      name: 'rebase with ignore-date',
      action: { kind: 'rebase', onto: 'main', ignoreDate: true },
      expected: [['rebase', '--ignore-date', 'main']]
    },
    {
      name: 'cherryPick',
      action: {
        kind: 'cherryPick',
        commit: 'abc123',
        noCommit: true,
        recordOrigin: true
      },
      expected: [['cherry-pick', '--no-commit', '-x', 'abc123']]
    },
    {
      name: 'revert',
      action: { kind: 'revert', commit: 'abc123' },
      expected: [['revert', '--no-edit', 'abc123']]
    },
    {
      name: 'reset hard',
      action: { kind: 'reset', target: 'abc123', mode: 'hard' },
      expected: [['reset', '--hard', 'abc123']]
    },
    {
      name: 'reset mixed',
      action: { kind: 'reset', target: 'abc123', mode: 'mixed' },
      expected: [['reset', '--mixed', 'abc123']]
    },
    {
      name: 'restoreBackup',
      action: { kind: 'restoreBackup', ref: 'refs/orca/backup/1-main' },
      expected: [['reset', '--hard', 'refs/orca/backup/1-main']]
    },
    {
      name: 'remoteAdd',
      action: {
        kind: 'remoteAdd',
        name: 'upstream',
        url: 'https://example.test/repo.git'
      },
      expected: [['remote', 'add', 'upstream', 'https://example.test/repo.git']]
    },
    {
      name: 'remoteRemove',
      action: { kind: 'remoteRemove', name: 'upstream' },
      expected: [['remote', 'remove', 'upstream']]
    },
    {
      name: 'remoteSetUrl',
      action: {
        kind: 'remoteSetUrl',
        name: 'upstream',
        url: 'git@example.test:repo.git'
      },
      expected: [['remote', 'set-url', 'upstream', 'git@example.test:repo.git']]
    }
  ]

  it.each(cases)('runs $name', async ({ action, expected }) => {
    const result = await runGitGraphAction(worktree, action)

    expect(result.ok).toBe(true)
    expect(actionCalls()).toEqual(expected)
  })
})

describe('runGitGraphAction validation', () => {
  const invalidCases: { name: string; action: GitGraphAction }[] = [
    {
      name: 'flag-like checkout branch',
      action: { kind: 'checkout', branch: '--force' }
    },
    {
      name: 'branch name with whitespace',
      action: {
        kind: 'createBranch',
        name: 'bad name',
        startPoint: 'HEAD',
        checkout: false
      }
    },
    {
      name: 'branch start point with a range',
      action: {
        kind: 'createBranch',
        name: 'feature',
        startPoint: 'HEAD..main',
        checkout: false
      }
    },
    {
      name: 'merge target with a range',
      action: {
        kind: 'merge',
        target: 'HEAD..main',
        noFastForward: false,
        squash: false,
        noCommit: false
      }
    },
    {
      name: 'negative stash index',
      action: { kind: 'stashApply', index: -1, reinstateIndex: false }
    },
    {
      name: 'control character in a tag name',
      action: { kind: 'deleteTag', name: 'v1\u0000' }
    },
    {
      name: 'flag-like remote',
      action: { kind: 'pushTag', name: 'v1', remote: '-o' }
    },
    {
      name: 'refspec-like remote',
      action: { kind: 'pushTag', name: 'v1', remote: 'origin:evil' }
    },
    {
      name: 'flag-like remote name',
      action: { kind: 'remoteAdd', name: '--force', url: 'https://example.test/repo.git' }
    },
    {
      name: 'flag-like remote URL',
      action: { kind: 'remoteAdd', name: 'upstream', url: '--upload-pack=evil' }
    },
    {
      name: 'non-backup ref restore',
      action: { kind: 'restoreBackup', ref: 'refs/heads/main' }
    }
  ]

  it.each(invalidCases)('rejects $name before running git', async ({ action }) => {
    const result = await runGitGraphAction(worktree, action)

    expect(result).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(calls).toEqual([])
  })

  it('rejects a branch that git check-ref-format refuses', async () => {
    installGitHandler((args) => {
      if (args[0] === 'check-ref-format') {
        throw execError('fatal: invalid branch name')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'createBranch',
      name: 'feature~1',
      startPoint: 'HEAD',
      checkout: true
    })

    expect(result).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(actionCalls()).toEqual([])
  })
})

describe('runGitGraphAction preflight', () => {
  it('blocks checkout of a branch occupied by another worktree', async () => {
    installGitHandler((args) => {
      if (args[0] === 'worktree') {
        return ok(
          `worktree ${worktree}\0HEAD abc\0branch refs/heads/main\0\0` +
            `worktree /other/worktree\0HEAD def\0branch refs/heads/release\0\0`
        )
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'checkout',
      branch: 'release'
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'occupied-branch',
      occupiedWorktree: '/other/worktree'
    })
    expect(actionCalls()).toEqual([])
  })

  it('blocks rename and delete of an occupied branch', async () => {
    installGitHandler((args) => {
      if (args[0] === 'worktree') {
        return ok(
          `worktree ${worktree}\0HEAD abc\0branch refs/heads/main\0\0` +
            `worktree /other/worktree\0HEAD def\0branch refs/heads/release\0\0`
        )
      }
      return ok()
    })

    await expect(
      runGitGraphAction(worktree, {
        kind: 'renameBranch',
        oldName: 'release',
        newName: 'renamed'
      })
    ).resolves.toMatchObject({ ok: false, code: 'occupied-branch' })
    await expect(
      runGitGraphAction(worktree, { kind: 'deleteBranch', name: 'release', force: true })
    ).resolves.toMatchObject({ ok: false, code: 'occupied-branch' })

    expect(actionCalls()).toEqual([])
  })

  it('blocks checkout with a dirty working tree', async () => {
    installGitHandler((args) => (args[0] === 'status' ? ok(' M file.ts\n') : ok()))

    const result = await runGitGraphAction(worktree, {
      kind: 'checkout',
      branch: 'feature'
    })

    expect(result).toMatchObject({ ok: false, code: 'dirty-worktree' })
    expect(actionCalls()).toEqual([])
  })

  it('blocks merge, rebase, and reset with a dirty working tree', async () => {
    installGitHandler((args) => (args[0] === 'status' ? ok(' M file.ts\n') : ok()))

    for (const action of [
      {
        kind: 'merge',
        target: 'main',
        noFastForward: false,
        squash: false,
        noCommit: false
      },
      { kind: 'rebase', onto: 'main', ignoreDate: false },
      { kind: 'reset', target: 'HEAD~1', mode: 'hard' }
    ] satisfies GitGraphAction[]) {
      await expect(runGitGraphAction(worktree, action)).resolves.toMatchObject({
        ok: false,
        code: 'dirty-worktree'
      })
    }

    expect(actionCalls()).toEqual([])
  })

  it('blocks a new mutation while a merge is in progress', async () => {
    await mkdir(join(worktree, '.git'))
    await writeFile(join(worktree, '.git', 'MERGE_HEAD'), 'abc\n')

    const result = await runGitGraphAction(worktree, {
      kind: 'checkout',
      branch: 'feature'
    })

    expect(result).toMatchObject({ ok: false, code: 'preflight', conflict: 'merge' })
    expect(actionCalls()).toEqual([])
  })

  it('refuses to delete the branch checked out in this worktree', async () => {
    const result = await runGitGraphAction(worktree, {
      kind: 'deleteBranch',
      name: 'main',
      force: true
    })

    expect(result).toMatchObject({ ok: false, code: 'preflight' })
    expect(actionCalls()).toEqual([])
  })
})

describe('runGitGraphAction continuation', () => {
  it('continues a merge with a non-interactive editor', async () => {
    await mkdir(join(worktree, '.git'))
    await writeFile(join(worktree, '.git', 'MERGE_HEAD'), 'abc\n')

    const result = await runGitGraphAction(worktree, { kind: 'continueOperation' })

    expect(result.ok).toBe(true)
    expect(actionCalls()).toEqual([['merge', '--continue']])
    expect(git).toHaveBeenCalledWith(
      ['merge', '--continue'],
      expect.objectContaining({ env: expect.objectContaining({ GIT_EDITOR: 'true' }) })
    )
  })

  it('refuses to continue while unresolved conflicts remain', async () => {
    await mkdir(join(worktree, '.git'))
    await writeFile(join(worktree, '.git', 'MERGE_HEAD'), 'abc\n')
    installGitHandler((args) => (args[0] === 'diff' ? ok('file.ts\n') : ok()))

    const result = await runGitGraphAction(worktree, { kind: 'continueOperation' })

    expect(result).toMatchObject({ ok: false, code: 'preflight' })
    expect(actionCalls()).toEqual([])
  })

  it('skips a rebase', async () => {
    await mkdir(join(worktree, '.git', 'rebase-merge'), { recursive: true })

    const result = await runGitGraphAction(worktree, { kind: 'skipOperation' })

    expect(result.ok).toBe(true)
    expect(actionCalls()).toEqual([['rebase', '--skip']])
  })

  it('rejects skip while a merge is in progress', async () => {
    await mkdir(join(worktree, '.git'))
    await writeFile(join(worktree, '.git', 'MERGE_HEAD'), 'abc\n')

    const result = await runGitGraphAction(worktree, { kind: 'skipOperation' })

    expect(result).toMatchObject({ ok: false, code: 'preflight' })
    expect(actionCalls()).toEqual([])
  })

  it('aborts a cherry-pick', async () => {
    await mkdir(join(worktree, '.git'))
    await writeFile(join(worktree, '.git', 'CHERRY_PICK_HEAD'), 'abc\n')

    const result = await runGitGraphAction(worktree, { kind: 'abortOperation' })

    expect(result.ok).toBe(true)
    expect(actionCalls()).toEqual([['cherry-pick', '--abort']])
  })

  it('detects a revert in progress', async () => {
    await mkdir(join(worktree, '.git'))
    await writeFile(join(worktree, '.git', 'REVERT_HEAD'), 'abc\n')

    const result = await runGitGraphAction(worktree, { kind: 'abortOperation' })

    expect(result.ok).toBe(true)
    expect(actionCalls()).toEqual([['revert', '--abort']])
  })

  it('reports preflight when no operation is in progress', async () => {
    const result = await runGitGraphAction(worktree, { kind: 'continueOperation' })

    expect(result).toMatchObject({ ok: false, code: 'preflight' })
    expect(actionCalls()).toEqual([])
  })
})

describe('runGitGraphAction backup refs', () => {
  it.each(backupCases)('creates a backup ref before $kind', async (action) => {
    const result = await runGitGraphAction(worktree, action)

    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.backupRef).toMatch(/^refs\/orca\/backup\/\d+-main-[0-9a-f-]{36}$/)
    expect(calls).toContainEqual([
      'update-ref',
      expect.stringMatching(/^refs\/orca\/backup\/\d+-main-[0-9a-f-]{36}$/),
      'a'.repeat(40),
      '0'.repeat(40)
    ])
  })

  it('uses the resolved HEAD OID width for the create-only guard', async () => {
    const headOid = 'b'.repeat(64)
    installGitHandler((args) => {
      if (args[0] === 'symbolic-ref') {
        return ok('main\n')
      }
      if (args[0] === 'rev-parse' && args[1] === '--verify' && args[2] === 'HEAD^{commit}') {
        return ok(`${headOid}\n`)
      }
      return ok()
    })

    await runGitGraphAction(worktree, {
      kind: 'merge',
      target: 'main',
      noFastForward: false,
      squash: false,
      noCommit: false
    })

    expect(calls).toContainEqual([
      'update-ref',
      expect.stringMatching(/^refs\/orca\/backup\/\d+-main-[0-9a-f-]{36}$/),
      headOid,
      '0'.repeat(64)
    ])
  })

  it('refuses the action when HEAD does not resolve to a full OID', async () => {
    installGitHandler((args) => {
      if (args[0] === 'rev-parse' && args[1] === '--verify' && args[2] === 'HEAD^{commit}') {
        return ok('not-an-oid\n')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'merge',
      target: 'main',
      noFastForward: false,
      squash: false,
      noCommit: false
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'preflight',
      message: 'Could not resolve HEAD for the backup ref.'
    })
    expect(calls.some((args) => args[0] === 'merge')).toBe(false)
  })

  it('does not create a backup ref for checkout or tags', async () => {
    await runGitGraphAction(worktree, { kind: 'checkout', branch: 'feature' })
    await runGitGraphAction(worktree, {
      kind: 'createTag',
      name: 'v1',
      target: 'HEAD',
      push: false
    })

    expect(calls.some((args) => args[0] === 'update-ref')).toBe(false)
  })

  it.each(backupFailureCases)(
    'refuses $name when the backup ref cannot be created',
    async ({ action, forbiddenCommand }) => {
      installGitHandler((args) => {
        if (args[0] === 'update-ref') {
          throw execError('fatal: cannot lock ref')
        }
        if (args[0] === 'symbolic-ref') {
          return ok('main\n')
        }
        if (args[0] === 'rev-list') {
          return ok(`${'a'.repeat(40)} ${'b'.repeat(40)}\n`)
        }
        if (args[0] === 'rev-parse') {
          return ok(`${'a'.repeat(40)}\n`)
        }
        return ok()
      })

      const result = await runGitGraphAction(worktree, action)

      expect(result).toMatchObject({
        ok: false,
        code: 'preflight',
        message: expect.stringContaining('Could not create a backup ref')
      })
      expect(calls.some((args) => args[0] === forbiddenCommand)).toBe(false)
    }
  )
})

describe('runGitGraphAction failure mapping', () => {
  it('maps a conflicted merge to the conflict code and detected operation', async () => {
    installGitHandler(async (args) => {
      if (isBackupHeadQuery(args)) {
        return ok(`${TEST_HEAD_OID}\n`)
      }
      if (args[0] === 'merge') {
        await mkdir(join(worktree, '.git'), { recursive: true })
        await writeFile(join(worktree, '.git', 'MERGE_HEAD'), 'abc\n')
        throw execError('CONFLICT (content): Merge conflict in file.ts')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'merge',
      target: 'main',
      noFastForward: false,
      squash: false,
      noCommit: false
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'conflict',
      conflict: 'merge',
      backupRef: expect.stringMatching(/^refs\/orca\/backup\//)
    })
    expect(result.ok === false && result.message).toContain('CONFLICT')
  })

  it('maps a conflicted rebase by stderr when no marker is readable', async () => {
    installGitHandler((args) => {
      if (isBackupHeadQuery(args)) {
        return ok(`${TEST_HEAD_OID}\n`)
      }
      if (args[0] === 'rebase') {
        throw execError('error: could not apply 123abc... change\nResolve all conflicts manually')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'rebase',
      onto: 'main',
      ignoreDate: false
    })

    expect(result).toMatchObject({ ok: false, code: 'conflict', conflict: 'rebase' })
  })

  it('maps a conflicted cherry-pick to the conflict code', async () => {
    installGitHandler((args) => {
      if (isBackupHeadQuery(args)) {
        return ok(`${TEST_HEAD_OID}\n`)
      }
      if (args[0] === 'cherry-pick') {
        throw execError('CONFLICT (content): Merge conflict in file.ts')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'cherryPick',
      commit: 'abc123',
      noCommit: false,
      recordOrigin: false
    })

    expect(result).toMatchObject({ ok: false, code: 'conflict', conflict: 'cherry-pick' })
  })

  it('refuses destructive stash actions without an atomic Git primitive', async () => {
    installGitHandler(() => ok())

    for (const action of [
      { kind: 'stashPop' as const, index: 0, reinstateIndex: false },
      { kind: 'stashDrop' as const, index: 0 }
    ]) {
      const result = await runGitGraphAction(worktree, action)
      expect(result).toMatchObject({ ok: false, code: 'preflight' })
    }
    expect(calls.some((args) => args[0] === 'stash')).toBe(false)
  })

  it('maps a stash conflict without inventing an operation', async () => {
    installGitHandler((args) => {
      if (args[0] === 'stash') {
        throw execError('CONFLICT (content): Merge conflict in file.ts')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'stashApply',
      index: 0,
      reinstateIndex: false
    })

    expect(result).toMatchObject({ ok: false, code: 'conflict' })
    expect(result.ok === false && 'conflict' in result).toBe(false)
  })

  it('maps other git failures to git-error and keeps the backup ref', async () => {
    installGitHandler((args) => {
      if (isBackupHeadQuery(args)) {
        return ok(`${TEST_HEAD_OID}\n`)
      }
      if (args[0] === 'reset') {
        throw execError('fatal: bad revision')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'reset',
      target: 'missing',
      mode: 'soft'
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'git-error',
      backupRef: expect.stringMatching(/^refs\/orca\/backup\//)
    })
  })
})

describe('dropCommit planning', () => {
  it('rebases later commits onto the dropped commit parent', async () => {
    installGitHandler((args) => {
      if (isBackupHeadQuery(args)) {
        return ok(`${TEST_HEAD_OID}\n`)
      }
      if (args[0] === 'symbolic-ref') {
        return ok('main\n')
      }
      if (args[0] === 'rev-list' && args[1] === '--parents') {
        return ok('aaaa bbbb\n')
      }
      if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
        return ok()
      }
      if (args[0] === 'rev-parse' && args.includes('HEAD')) {
        return ok('cccc\n')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'dropCommit',
      commit: 'aaaa'
    })

    expect(result.ok).toBe(true)
    expect(actionCalls()).toEqual([['rebase', '--onto', 'bbbb', 'aaaa']])
  })

  it('drops HEAD with a mixed reset', async () => {
    installGitHandler((args) => {
      if (isBackupHeadQuery(args)) {
        return ok(`${TEST_HEAD_OID}\n`)
      }
      if (args[0] === 'symbolic-ref') {
        return ok('main\n')
      }
      if (args[0] === 'rev-list' && args[1] === '--parents') {
        return ok('aaaa bbbb\n')
      }
      if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
        return ok()
      }
      if (args[0] === 'rev-parse' && args.includes('HEAD')) {
        return ok('aaaa\n')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'dropCommit',
      commit: 'aaaa'
    })

    expect(result.ok).toBe(true)
    expect(actionCalls()).toEqual([['reset', '--mixed', 'bbbb']])
  })

  it('rejects merge commits', async () => {
    installGitHandler((args) => {
      if (args[0] === 'symbolic-ref') {
        return ok('main\n')
      }
      if (args[0] === 'rev-list' && args[1] === '--parents') {
        return ok('aaaa bbbb cccc\n')
      }
      return ok()
    })

    const result = await runGitGraphAction(worktree, {
      kind: 'dropCommit',
      commit: 'aaaa'
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: 'Cannot drop a merge commit.'
    })
    expect(actionCalls()).toEqual([])
  })
})
