// Verifies the user-facing entry path to Git Graph from the app's initial state:
// the tab bar's "+" create menu must expose "Open Git Graph" for a Git worktree.
// Regression for the report that no visible menu or icon reached the graph.
import { test, expect } from './helpers/git-graph-app'
import { waitForSessionReady, waitForActiveWorktree } from './helpers/store'

test('opens Git Graph from the tab bar create menu without any prior navigation', async ({
  orcaPage
}) => {
  // Why: cold app start plus the first graph render can exceed the default E2E timeout.
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)

  // The tab bar's create button; the app locale picks the label ("New tab"/"새 탭").
  await orcaPage.getByRole('button', { name: /^(New tab|새 탭)$/ }).click()

  // The menu must list the graph entry with a readable label.
  const menuItem = orcaPage.getByRole('menuitem', { name: /Open Git Graph|Git Graph 열기/ })
  await expect(menuItem).toBeVisible({ timeout: 10_000 })

  // Selecting it opens a real Git Graph tab without any other navigation.
  await menuItem.click()
  await expect(orcaPage.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible({
    timeout: 20_000
  })
  await expect(orcaPage.locator('[data-testid="git-graph-row"]').first()).toBeVisible({
    timeout: 20_000
  })
})
