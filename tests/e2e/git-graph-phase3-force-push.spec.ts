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

test('force pushes a divergent branch with an explicit acknowledgment', async ({
  orcaPage,
  seededRepoPath
}) => {
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  const branch = git(seededRepoPath, ['branch', '--show-current'])
  const origin = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-force-origin-'))
  const clone = mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-force-clone-'))
  try {
    git(origin, ['init', '--bare'])
    git(seededRepoPath, ['remote', 'add', 'origin', pathToFileURL(origin).href])
    git(seededRepoPath, ['push', '-u', 'origin', `${branch}:${branch}`])
    git(seededRepoPath, ['branch', `--set-upstream-to=origin/${branch}`, branch])

    execFileSync('git', ['clone', pathToFileURL(origin).href, clone], { encoding: 'utf8' })
    git(clone, ['config', 'user.email', 'e2e@test.local'])
    git(clone, ['config', 'user.name', 'e2e'])
    appendFileSync(path.join(clone, 'README.md'), '\nremote only\n')
    git(clone, ['commit', '-am', 'remote only'])
    git(clone, ['push', 'origin', branch])

    appendFileSync(path.join(seededRepoPath, 'README.md'), '\nlocal only\n')
    git(seededRepoPath, ['commit', '-am', 'local only'])
    git(seededRepoPath, ['fetch', 'origin'])
    const localHead = git(seededRepoPath, ['rev-parse', 'HEAD'])

    await orcaPage.evaluate(
      async ({ targetWorktreeId }) => {
        await window.__store?.getState().updateSettings({ uiLanguage: 'en' })
        const store = window.__store
        if (!store) {
          throw new Error('store unavailable')
        }
        const state = store.getState()
        const groupId =
          state.activeGroupIdByWorktree[targetWorktreeId] ??
          state.groupsByWorktree[targetWorktreeId]?.[0]?.id
        if (!groupId) {
          throw new Error('no tab group')
        }
        const tab = state.createUnifiedTab(targetWorktreeId, 'git-graph', {
          label: 'Git Graph',
          targetGroupId: groupId,
          activate: true
        })
        store.getState().activateTab(tab.id)
        store.getState().setActiveTabType('git-graph', targetWorktreeId)
      },
      { targetWorktreeId: worktreeId }
    )
    await expect(orcaPage.getByRole('button', { name: 'Force push' })).toBeVisible({
      timeout: 15_000
    })
    await orcaPage.getByRole('button', { name: 'Force push' }).click()
    const run = orcaPage.getByRole('button', { name: 'Run' })
    await expect(run).toBeDisabled()
    await orcaPage.getByRole('checkbox').check()
    await expect(run).toBeEnabled()
    await run.click()
    await expect
      .poll(() => orcaPage.getByRole('button', { name: 'Force push' }).isDisabled())
      .toBe(true)
    await expect
      .poll(() => orcaPage.getByRole('button', { name: 'Force push' }).isDisabled())
      .toBe(false)

    await expect
      .poll(() => ({
        remote: git(origin, ['rev-parse', `refs/heads/${branch}`]),
        local: git(seededRepoPath, ['rev-parse', 'HEAD']),
        upstream: git(seededRepoPath, ['rev-parse', '--abbrev-ref', '@{upstream}'])
      }))
      .toMatchObject({ remote: localHead, local: localHead })
  } finally {
    try {
      git(seededRepoPath, ['remote', 'remove', 'origin'])
    } catch {
      // Remote may already be gone.
    }
    rmSync(origin, { recursive: true, force: true })
    rmSync(clone, { recursive: true, force: true })
  }
})
