import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'
import type { GitGraphAction, GitGraphActionResult } from '../../src/shared/git-graph-actions'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

async function runGraphAction(
  page: Parameters<typeof waitForActiveWorktree>[0],
  repoPath: string,
  action: GitGraphAction
): Promise<GitGraphActionResult> {
  return page.evaluate(
    async ({ worktreePath, action }) => window.api.git.graphAction({ worktreePath, action }),
    { worktreePath: repoPath, action }
  )
}

async function openGitGraph(
  page: Parameters<typeof waitForActiveWorktree>[0],
  worktreeId: string
): Promise<void> {
  await page.evaluate(
    async ({ targetWorktreeId }) => {
      await window.__store?.getState().updateSettings({ uiLanguage: 'en' })
      const store = window.__store
      if (!store) {
        throw new Error('store unavailable')
      }
      const state = store.getState()
      const targetGroupId =
        state.activeGroupIdByWorktree[targetWorktreeId] ??
        state.groupsByWorktree[targetWorktreeId]?.[0]?.id
      if (!targetGroupId) {
        throw new Error('no tab group for worktree')
      }
      const tab = state.createUnifiedTab(targetWorktreeId, 'git-graph', {
        label: 'Git Graph',
        targetGroupId,
        activate: true
      })
      store.getState().activateTab(tab.id)
      store.getState().setActiveTabType('git-graph', targetWorktreeId)
    },
    { targetWorktreeId: worktreeId }
  )
  await expect(page.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible({
    timeout: 15_000
  })
  await expect(page.locator('[data-testid="git-graph-row"]').first()).toBeVisible({
    timeout: 15_000
  })
}

test('aborts a merge conflict and restores a hard-reset backup through the UI', async ({
  orcaPage,
  seededRepoPath
}) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  const defaultBranch = git(seededRepoPath, ['branch', '--show-current'])
  const initialHead = git(seededRepoPath, ['rev-parse', 'HEAD'])
  const initialStashes = git(seededRepoPath, ['stash', 'list', '--format=%H'])
  const initialRemotes = git(seededRepoPath, ['remote'])
  const backupRefs = git(seededRepoPath, [
    'for-each-ref',
    '--format=%(refname)',
    'refs/orca/backup'
  ])
  try {
    git(seededRepoPath, ['checkout', '-qb', 'phase3-conflict'])
    appendFileSync(path.join(seededRepoPath, 'README.md'), '\nconflict branch\n')
    git(seededRepoPath, ['commit', '-am', 'conflict branch'])
    appendFileSync(path.join(seededRepoPath, 'phase3-cherry.txt'), 'cherry\n')
    git(seededRepoPath, ['add', 'phase3-cherry.txt'])
    git(seededRepoPath, ['commit', '-m', 'cherry source'])
    git(seededRepoPath, ['checkout', defaultBranch])
    git(seededRepoPath, ['checkout', '-q', '--orphan', 'phase3-side'])
    git(seededRepoPath, ['rm', '-rf', '.'])
    appendFileSync(path.join(seededRepoPath, 'phase3-side.txt'), 'side\n')
    git(seededRepoPath, ['add', 'phase3-side.txt'])
    git(seededRepoPath, ['commit', '-m', 'independent side'])
    const independentSource = git(seededRepoPath, ['rev-parse', 'HEAD'])
    git(seededRepoPath, ['checkout', '-q', defaultBranch])
    git(seededRepoPath, ['checkout', defaultBranch])
    appendFileSync(path.join(seededRepoPath, 'README.md'), '\nconflict main\n')
    git(seededRepoPath, ['commit', '-am', 'conflict main'])
    const headBeforeMerge = git(seededRepoPath, ['rev-parse', 'HEAD'])

    await openGitGraph(orcaPage, worktreeId)
    const conflictRow = orcaPage.locator('[data-testid="git-graph-row"]').filter({
      has: orcaPage.getByRole('button', { name: 'phase3-conflict', exact: true })
    })
    await expect(conflictRow).toBeVisible({ timeout: 15_000 })
    await conflictRow.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: 'Merge phase3-conflict into current' }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()

    await expect(orcaPage.getByText(/merge ·/i)).toBeVisible({ timeout: 15_000 })
    await expect(orcaPage.getByRole('button', { name: 'Abort' })).toBeVisible()
    await orcaPage.getByRole('button', { name: 'Abort' }).click()
    await expect.poll(() => git(seededRepoPath, ['rev-parse', 'HEAD'])).toBe(headBeforeMerge)
    await expect.poll(() => git(seededRepoPath, ['status', '--porcelain'])).toBe('')

    await conflictRow.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: 'Merge phase3-conflict into current' }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect(orcaPage.getByText(/merge ·/i)).toBeVisible({ timeout: 15_000 })
    const conflicted = readFileSync(path.join(seededRepoPath, 'README.md'), 'utf8')
    expect(conflicted).toContain('<<<<<<<')
    writeFileSync(path.join(seededRepoPath, 'README.md'), 'resolved\n')
    git(seededRepoPath, ['add', 'README.md'])
    await orcaPage.getByRole('button', { name: 'Continue' }).click()
    await expect.poll(() => git(seededRepoPath, ['status', '--porcelain'])).toBe('')
    await expect
      .poll(() => git(seededRepoPath, ['log', '-1', '--format=%P']).split(' ').length)
      .toBe(2)

    const preResetHead = git(seededRepoPath, ['rev-parse', 'HEAD'])
    const resetTarget = git(seededRepoPath, ['rev-parse', `${headBeforeMerge}^`])
    expect(resetTarget).not.toBe(preResetHead)
    const mainRow = orcaPage.locator(
      `[data-testid="git-graph-row"][data-commit-id="${resetTarget}"]`
    )
    await expect(mainRow).toBeVisible({ timeout: 15_000 })
    await mainRow.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: 'Reset current branch to here' }).click()
    await orcaPage.getByLabel('Reset mode').selectOption('hard')
    await orcaPage.getByRole('checkbox').check()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(seededRepoPath, ['rev-parse', 'HEAD'])).toBe(resetTarget)

    const backupsAfterReset = git(seededRepoPath, [
      'for-each-ref',
      '--format=%(refname)',
      'refs/orca/backup'
    ]).split('\n')
    const resetBackup = backupsAfterReset.find(
      (ref) => ref && git(seededRepoPath, ['rev-parse', ref]) === preResetHead
    )
    if (!resetBackup) {
      throw new Error('hard reset did not create a backup for the pre-reset HEAD')
    }
    await orcaPage.getByRole('button', { name: /^Backups/ }).click()
    await orcaPage
      .getByRole('button', { name: 'Restore' })
      .nth(backupsAfterReset.filter(Boolean).indexOf(resetBackup))
      .click()
    await orcaPage.getByRole('button', { name: 'Confirm restore' }).click()
    await expect.poll(() => git(seededRepoPath, ['rev-parse', 'HEAD'])).toBe(preResetHead)

    git(seededRepoPath, ['checkout', '-q', 'phase3-conflict'])
    appendFileSync(path.join(seededRepoPath, 'README.md'), '\nrebase conflict\n')
    git(seededRepoPath, ['commit', '-am', 'rebase conflict'])
    const conflictSource = git(seededRepoPath, ['rev-parse', 'HEAD'])
    const rebaseHead = conflictSource
    const rebaseRow = orcaPage.locator('[data-testid="git-graph-row"]').filter({
      has: orcaPage.getByRole('button', { name: defaultBranch, exact: true })
    })
    await expect(rebaseRow).toBeVisible({ timeout: 15_000 })
    await rebaseRow.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: `Rebase current onto ${defaultBranch}` }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect(orcaPage.getByText(/rebase ·/i)).toBeVisible({ timeout: 15_000 })
    await orcaPage.getByRole('button', { name: 'Skip' }).click()
    await expect
      .poll(() => {
        const gitDir = git(seededRepoPath, ['rev-parse', '--git-dir'])
        return (
          !existsSync(path.resolve(seededRepoPath, gitDir, 'rebase-merge')) &&
          !existsSync(path.resolve(seededRepoPath, gitDir, 'rebase-apply'))
        )
      })
      .toBe(true)
    await expect.poll(() => git(seededRepoPath, ['status', '--porcelain'])).toBe('')
    await expect.poll(() => git(seededRepoPath, ['rev-parse', 'HEAD'])).not.toBe(rebaseHead)

    git(seededRepoPath, ['checkout', '-q', defaultBranch])
    const cherryResult = await runGraphAction(orcaPage, seededRepoPath, {
      kind: 'cherryPick',
      commit: independentSource,
      noCommit: false,
      recordOrigin: false
    })
    if (!cherryResult.ok) {
      throw new Error(`cherry-pick failed: ${cherryResult.code}: ${cherryResult.message}`)
    }
    expect(git(seededRepoPath, ['log', '-1', '--format=%s'])).toBe('independent side')

    const cherryHead = git(seededRepoPath, ['rev-parse', 'HEAD'])
    const revertResult = await runGraphAction(orcaPage, seededRepoPath, {
      kind: 'revert',
      commit: cherryHead
    })
    expect(revertResult).toMatchObject({ ok: true })
    expect(git(seededRepoPath, ['log', '-1', '--format=%s'])).toContain('Revert')

    const beforeDrop = git(seededRepoPath, ['rev-parse', 'HEAD'])
    const dropResult = await runGraphAction(orcaPage, seededRepoPath, {
      kind: 'dropCommit',
      commit: beforeDrop
    })
    expect(dropResult).toMatchObject({ ok: true })
    expect(git(seededRepoPath, ['rev-parse', 'HEAD'])).not.toBe(beforeDrop)
  } finally {
    const operations: [string, string[]][] = [
      ['MERGE_HEAD', ['merge', '--abort']],
      ['REBASE_HEAD', ['rebase', '--abort']],
      ['CHERRY_PICK_HEAD', ['cherry-pick', '--abort']],
      ['REVERT_HEAD', ['revert', '--abort']]
    ]
    for (const [marker, command] of operations) {
      try {
        if (git(seededRepoPath, ['rev-parse', '--verify', marker])) {
          git(seededRepoPath, command)
        }
      } catch {
        // This operation is not in progress.
      }
    }
    try {
      git(seededRepoPath, ['checkout', defaultBranch])
      git(seededRepoPath, ['branch', '-D', 'phase3-conflict'])
      git(seededRepoPath, ['branch', '-D', 'phase3-side'])
    } catch {
      // The branch may already be gone after a failed launch.
    }
    try {
      git(seededRepoPath, ['reset', '--hard', initialHead])
      for (const remote of git(seededRepoPath, ['remote']).split('\n')) {
        if (remote && !initialRemotes.split('\n').includes(remote)) {
          git(seededRepoPath, ['remote', 'remove', remote])
        }
      }
      for (const line of git(seededRepoPath, ['stash', 'list', '--format=%H %gd']).split('\n')) {
        const [oid, selector] = line.split(' ')
        if (oid && selector && !initialStashes.split('\n').includes(oid)) {
          git(seededRepoPath, ['stash', 'drop', selector])
        }
      }
      for (const ref of git(seededRepoPath, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/orca/backup'
      ]).split('\n')) {
        if (ref && !backupRefs.split('\n').includes(ref)) {
          git(seededRepoPath, ['update-ref', '-d', ref])
        }
      }
    } catch {
      // The disposable seeded repo may already be gone.
    }
  }
})
