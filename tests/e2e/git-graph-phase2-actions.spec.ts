import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
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

test('runs stash, sync, checkout, rename, and delete through the UI', async ({
  orcaPage,
  seededRepoPath
}) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  const defaultBranch = git(seededRepoPath, ['branch', '--show-current'])
  const origin = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-phase2-origin-'))
  try {
    git(origin, ['init', '--bare'])
    git(seededRepoPath, ['remote', 'add', 'e2e-origin', `${pathToFileURL(origin).href}`])
    git(seededRepoPath, ['push', '-u', 'e2e-origin', defaultBranch])
    appendFileSync(path.join(seededRepoPath, 'README.md'), '\nstash me\n')

    await openGitGraph(orcaPage, worktreeId)
    const toolbar = orcaPage.locator('.flex.h-10').first()
    await expect(toolbar.getByRole('button', { name: 'Stash' })).toBeVisible({ timeout: 15_000 })
    await toolbar.getByRole('button', { name: 'Stash' }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(seededRepoPath, ['stash', 'list'])).toContain('stash')
    await orcaPage.getByRole('button', { name: /^Stashes/ }).click()
    await orcaPage.getByRole('button', { name: 'Apply' }).click()
    await expect.poll(() => git(seededRepoPath, ['status', '--porcelain'])).toContain('README.md')
    git(seededRepoPath, ['reset', '--hard'])
    appendFileSync(path.join(seededRepoPath, 'README.md'), '\nlocal push commit\n')
    git(seededRepoPath, ['add', 'README.md'])
    git(seededRepoPath, ['commit', '-m', 'local push commit'])

    await orcaPage.getByRole('button', { name: 'Push' }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(origin, ['log', '-1', '--format=%s'])).toBe('local push commit')

    const clone = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-phase2-clone-'))
    try {
      execFileSync('git', ['clone', `${pathToFileURL(origin).href}`, clone], { encoding: 'utf8' })
      git(clone, ['config', 'user.email', 'e2e@test.local'])
      git(clone, ['config', 'user.name', 'e2e'])
      appendFileSync(path.join(clone, 'README.md'), '\nremote change\n')
      git(clone, ['commit', '-am', 'remote change'])
      git(clone, ['push', 'origin', defaultBranch])
    } finally {
      rmSync(clone, { recursive: true, force: true })
    }
    await orcaPage.getByRole('button', { name: 'Pull' }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(seededRepoPath, ['log', '-1', '--format=%s'])).toBe('remote change')

    const row = orcaPage.locator('[data-testid="git-graph-row"]').first()
    await row.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: 'Create branch here' }).click()
    const branchName = `e2e-phase2-${Date.now()}`
    await orcaPage.getByLabel('Branch name').fill(branchName)
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(seededRepoPath, ['branch', '--show-current'])).toBe(branchName)

    await row.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: `Checkout ${defaultBranch}` }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(seededRepoPath, ['branch', '--show-current'])).toBe(defaultBranch)

    const branchRow = orcaPage.locator('[data-testid="git-graph-row"]').filter({
      has: orcaPage.getByRole('button', { name: branchName, exact: true })
    })
    await branchRow.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: `Rename ${branchName}` }).click()
    const renamed = `${branchName}-renamed`
    await orcaPage.getByLabel('Branch name').fill(renamed)
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(seededRepoPath, ['branch', '--list', renamed])).toContain(renamed)
    const renamedRow = orcaPage.locator('[data-testid="git-graph-row"]').filter({
      has: orcaPage.getByRole('button', { name: renamed, exact: true })
    })
    await expect(renamedRow).toBeVisible({ timeout: 15_000 })

    await renamedRow.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: `Delete ${renamed}` }).click()
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect.poll(() => git(seededRepoPath, ['branch', '--list', renamed])).toBe('')
  } finally {
    try {
      git(seededRepoPath, ['checkout', defaultBranch])
      git(seededRepoPath, ['remote', 'remove', 'e2e-origin'])
      git(seededRepoPath, ['stash', 'clear'])
      git(seededRepoPath, ['reset', '--hard'])
    } catch {
      // The disposable seeded repo may already be gone after a failed launch.
    }
    rmSync(origin, { recursive: true, force: true })
  }
})
