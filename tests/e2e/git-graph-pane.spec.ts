import { execFileSync } from 'node:child_process'
import { test, expect } from './helpers/orca-app'
import { waitForSessionReady, waitForActiveWorktree } from './helpers/store'

test.describe('Git Graph pane', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
  })

  test('renders commits and persists column visibility', async ({ orcaPage }, testInfo) => {
    const worktreeId = await waitForActiveWorktree(orcaPage)

    await orcaPage.evaluate((targetWorktreeId) => {
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
    }, worktreeId)

    await expect(orcaPage.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible({
      timeout: 15_000
    })
    await expect(orcaPage.locator('[data-testid="git-graph-row"]').first()).toBeVisible({
      timeout: 15_000
    })
    expect(await orcaPage.locator('[data-testid="git-graph-row"]').count()).toBeGreaterThan(0)
    await expect(orcaPage.getByText('Author', { exact: true })).toBeVisible()

    const resizeAuthor = orcaPage.getByRole('separator', { name: 'Resize author column' })
    await resizeAuthor.focus()
    await resizeAuthor.press('ArrowRight')
    await expect(resizeAuthor).toHaveAttribute('aria-valuenow', '140')
    const resized = await orcaPage.evaluate(() =>
      localStorage.getItem('orca.gitGraph.viewSettings.v1')
    )
    expect(JSON.parse(resized ?? '{}')).toMatchObject({ authorWidth: 140 })

    await orcaPage.getByRole('button', { name: 'Git Graph view settings' }).click()
    await orcaPage.getByRole('menuitemcheckbox', { name: 'Author column' }).click()

    await expect(orcaPage.getByText('Author', { exact: true })).toHaveCount(0)
    const stored = await orcaPage.evaluate(() =>
      localStorage.getItem('orca.gitGraph.viewSettings.v1')
    )
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ showAuthor: false })

    await orcaPage.screenshot({ path: testInfo.outputPath('git-graph-pane.png') })
  })

  test('creates a tag through the row context menu', async ({ orcaPage, seededRepoPath }) => {
    const worktreeId = await waitForActiveWorktree(orcaPage)
    await orcaPage.evaluate(
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
    const row = orcaPage.locator('[data-testid="git-graph-row"]').first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: 'Create tag here' }).click()
    const tagName = `e2e-ui-${Date.now()}`
    await orcaPage.getByLabel('Tag name').fill(tagName)
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect
      .poll(
        () =>
          execFileSync('git', ['-C', seededRepoPath, 'tag', '--list', tagName], {
            encoding: 'utf8'
          }).trim(),
        { timeout: 15_000 }
      )
      .toBe(tagName)

    await row.click({ button: 'right' })
    await orcaPage.getByRole('menuitem', { name: 'Create branch here' }).click()
    const branchName = `e2e-ui-branch-${Date.now()}`
    await orcaPage.getByLabel('Branch name').fill(branchName)
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect
      .poll(
        () =>
          execFileSync('git', ['-C', seededRepoPath, 'branch', '--list', branchName], {
            encoding: 'utf8'
          }).trim(),
        { timeout: 15_000 }
      )
      .toContain(branchName)

    const remoteName = `e2e-ui-remote-${Date.now()}`
    await orcaPage.getByRole('button', { name: 'Remotes' }).click()
    await orcaPage.getByLabel('Remote name').fill(remoteName)
    await orcaPage.getByLabel('Remote URL').fill('https://example.com/e2e.git')
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect
      .poll(
        () => execFileSync('git', ['-C', seededRepoPath, 'remote'], { encoding: 'utf8' }).trim(),
        { timeout: 15_000 }
      )
      .toContain(remoteName)

    await orcaPage.getByRole('button', { name: 'Remotes' }).click()
    await orcaPage.getByLabel('Operation').selectOption('remove')
    await orcaPage.getByLabel('Remote name').fill(remoteName)
    await orcaPage.getByRole('button', { name: 'Run' }).click()
    await expect
      .poll(
        () => execFileSync('git', ['-C', seededRepoPath, 'remote'], { encoding: 'utf8' }).trim(),
        { timeout: 15_000 }
      )
      .not.toContain(remoteName)

    await orcaPage.getByRole('button', { name: 'Fetch' }).click()
    await expect(orcaPage.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible()
  })
})
