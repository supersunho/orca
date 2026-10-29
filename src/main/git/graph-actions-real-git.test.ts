import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runGitGraphAction } from './graph-actions'

const roots: string[] = []

function git(repo: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

async function createRepository({ objectFormat }: { objectFormat?: 'sha256' } = {}): Promise<{
  root: string
  repo: string
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-graph-actions-real-'))
  roots.push(root)
  const repo = path.join(root, 'repo')
  const hooks = path.join(root, 'hooks')
  await mkdir(hooks)
  git(root, ['init', '--quiet', ...(objectFormat ? [`--object-format=${objectFormat}`] : []), repo])
  git(repo, ['symbolic-ref', 'HEAD', 'refs/heads/main'])
  git(repo, ['config', 'user.email', 'graph-actions@example.test'])
  git(repo, ['config', 'user.name', 'Graph Actions Test'])
  git(repo, ['config', 'commit.gpgsign', 'false'])
  git(repo, ['config', 'tag.gpgsign', 'false'])
  git(repo, ['config', 'core.hooksPath', hooks])
  await writeFile(path.join(repo, 'tracked.txt'), 'base\n')
  git(repo, ['add', 'tracked.txt'])
  git(repo, ['commit', '--quiet', '-m', 'base'])
  return { root, repo }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('runGitGraphAction real git', () => {
  it('creates a backup ref in a sha256 repository', async () => {
    const { repo } = await createRepository({ objectFormat: 'sha256' })
    expect(git(repo, ['rev-parse', '--show-object-format'])).toBe('sha256')

    await writeFile(path.join(repo, 'tracked.txt'), 'second\n')
    git(repo, ['add', 'tracked.txt'])
    git(repo, ['commit', '--quiet', '-m', 'second'])
    const head = git(repo, ['rev-parse', 'HEAD'])

    const result = await runGitGraphAction(repo, {
      kind: 'reset',
      target: 'HEAD~1',
      mode: 'hard'
    })

    expect(result.ok).toBe(true)
    if (!result.ok || !result.backupRef) {
      throw new Error('expected a backup ref')
    }
    expect(git(repo, ['rev-parse', `${result.backupRef}^{commit}`])).toBe(head)
  })

  it('creates and deletes branches and tags, and round-trips a stash', async () => {
    const { repo } = await createRepository()

    const branch = await runGitGraphAction(repo, {
      kind: 'createBranch',
      name: 'feature/x',
      startPoint: 'HEAD',
      checkout: true
    })
    expect(branch).toEqual({ ok: true })
    expect(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('feature/x')

    const tag = await runGitGraphAction(repo, {
      kind: 'createTag',
      name: 'v1.0.0',
      target: 'HEAD',
      push: false
    })
    expect(tag).toEqual({ ok: true })
    expect(git(repo, ['tag', '--list'])).toBe('v1.0.0')

    const deletedTag = await runGitGraphAction(repo, {
      kind: 'deleteTag',
      name: 'v1.0.0'
    })
    expect(deletedTag).toEqual({ ok: true })
    expect(git(repo, ['tag', '--list'])).toBe('')

    await writeFile(path.join(repo, 'tracked.txt'), 'changed\n')
    await writeFile(path.join(repo, 'untracked.txt'), 'new\n')

    const stash = await runGitGraphAction(repo, {
      kind: 'stashCreate',
      includeUntracked: true,
      message: 'wip'
    })
    expect(stash).toEqual({ ok: true })
    expect(git(repo, ['status', '--porcelain'])).toBe('')

    const applied = await runGitGraphAction(repo, {
      kind: 'stashApply',
      index: 0,
      reinstateIndex: true
    })
    expect(applied).toEqual({ ok: true })
    expect(await readFile(path.join(repo, 'tracked.txt'), 'utf8')).toBe('changed\n')
    expect(await readFile(path.join(repo, 'untracked.txt'), 'utf8')).toBe('new\n')
    git(repo, ['add', '.'])
    git(repo, ['commit', '--quiet', '-m', 'stashed changes'])

    const checkout = await runGitGraphAction(repo, {
      kind: 'checkout',
      branch: 'main'
    })
    expect(checkout).toEqual({ ok: true })

    const deletedBranch = await runGitGraphAction(repo, {
      kind: 'deleteBranch',
      name: 'feature/x',
      force: true
    })
    expect(deletedBranch).toEqual({ ok: true })
  })

  it('returns a typed rebase conflict with a backup ref and finishes with continue', async () => {
    const { repo } = await createRepository()
    git(repo, ['checkout', '-qb', 'feature'])
    await writeFile(path.join(repo, 'tracked.txt'), 'feature\n')
    git(repo, ['commit', '--quiet', '-am', 'feature change'])
    const featureHead = git(repo, ['rev-parse', 'HEAD'])

    git(repo, ['checkout', '-q', 'main'])
    await writeFile(path.join(repo, 'tracked.txt'), 'main\n')
    git(repo, ['commit', '--quiet', '-am', 'main change'])

    git(repo, ['checkout', '-q', 'feature'])
    const result = await runGitGraphAction(repo, {
      kind: 'rebase',
      onto: 'main',
      ignoreDate: false
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected a rebase conflict')
    }
    expect(result.code).toBe('conflict')
    expect(result.conflict).toBe('rebase')
    expect(result.backupRef).toMatch(/^refs\/orca\/backup\/\d+-feature-[0-9a-f]{8}$/)
    const backupRef = result.backupRef
    if (!backupRef) {
      throw new Error('expected a backup ref')
    }
    expect(git(repo, ['rev-parse', `${backupRef}^{commit}`])).toBe(featureHead)

    const blocked = await runGitGraphAction(repo, { kind: 'continueOperation' })
    expect(blocked).toMatchObject({ ok: false, code: 'preflight' })

    await writeFile(path.join(repo, 'tracked.txt'), 'resolved\n')
    git(repo, ['add', 'tracked.txt'])

    const continued = await runGitGraphAction(repo, { kind: 'continueOperation' })
    expect(continued).toEqual({ ok: true })
    expect(git(repo, ['status', '--porcelain'])).toBe('')
    expect(git(repo, ['log', '-1', '--format=%s'])).toBe('feature change')
  })

  it('blocks checkout of a branch occupied by another worktree', async () => {
    const { root, repo } = await createRepository()
    git(repo, ['branch', 'release'])
    git(repo, ['worktree', 'add', path.join(root, 'release-worktree'), 'release'])

    const result = await runGitGraphAction(repo, {
      kind: 'checkout',
      branch: 'release'
    })

    expect(result).toMatchObject({ ok: false, code: 'occupied-branch' })
    expect(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('main')
  })

  it('manages remotes and restores a backup ref', async () => {
    const { repo } = await createRepository()
    expect(
      await runGitGraphAction(repo, {
        kind: 'remoteAdd',
        name: 'upstream',
        url: 'https://example.test/repo.git'
      })
    ).toEqual({ ok: true })
    expect(git(repo, ['remote', 'get-url', 'upstream'])).toBe('https://example.test/repo.git')

    expect(
      await runGitGraphAction(repo, {
        kind: 'remoteSetUrl',
        name: 'upstream',
        url: 'git@example.test:repo.git'
      })
    ).toEqual({ ok: true })
    expect(git(repo, ['remote', 'get-url', 'upstream'])).toBe('git@example.test:repo.git')

    expect(await runGitGraphAction(repo, { kind: 'remoteRemove', name: 'upstream' })).toEqual({
      ok: true
    })
    expect(git(repo, ['remote'])).toBe('')

    const base = git(repo, ['rev-parse', 'HEAD'])
    git(repo, ['update-ref', 'refs/orca/backup/1-main', base])
    await writeFile(path.join(repo, 'tracked.txt'), 'next\n')
    git(repo, ['add', 'tracked.txt'])
    git(repo, ['commit', '--quiet', '-m', 'next'])
    expect(git(repo, ['rev-parse', 'HEAD'])).not.toBe(base)

    const restored = await runGitGraphAction(repo, {
      kind: 'restoreBackup',
      ref: 'refs/orca/backup/1-main'
    })
    expect(restored.ok).toBe(true)
    expect(git(repo, ['rev-parse', 'HEAD'])).toBe(base)
  })

  it('drops a middle commit and replays later commits', async () => {
    const { repo } = await createRepository()
    await writeFile(path.join(repo, 'second.txt'), 'second\n')
    git(repo, ['add', 'second.txt'])
    git(repo, ['commit', '--quiet', '-m', 'second'])
    const second = git(repo, ['rev-parse', 'HEAD'])

    await writeFile(path.join(repo, 'third.txt'), 'third\n')
    git(repo, ['add', 'third.txt'])
    git(repo, ['commit', '--quiet', '-m', 'third'])

    const result = await runGitGraphAction(repo, {
      kind: 'dropCommit',
      commit: second
    })

    expect(result.ok).toBe(true)
    expect(git(repo, ['log', '--format=%s', '-2'])).toBe('third\nbase')
    expect(git(repo, ['ls-files'])).not.toContain('second.txt')
  })
})
