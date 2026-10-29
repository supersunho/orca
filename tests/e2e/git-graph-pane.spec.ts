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
})
