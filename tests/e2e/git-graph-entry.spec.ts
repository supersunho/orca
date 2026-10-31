// Verifies the Git Graph entry icon in the right sidebar's top activity bar
// (top-right, beside the panel toggle) opens the graph for the active worktree.
import { test, expect } from './helpers/git-graph-app'
import { waitForSessionReady, waitForActiveWorktree } from './helpers/store'

test('shows the Git Graph entry in the sidebar header and opens the graph', async ({
  orcaPage
}) => {
  // Why: cold app start plus first graph render can exceed the default E2E timeout.
  test.setTimeout(180_000)
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)

  const entry = orcaPage.getByRole('button', {
    name: /Open Git Graph|Git Graph 열기/
  })
  await expect(entry.first()).toBeVisible({ timeout: 20_000 })
  await entry.first().click()

  await expect(orcaPage.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible({
    timeout: 20_000
  })
  await expect(orcaPage.locator('[data-testid="git-graph-row"]').first()).toBeVisible({
    timeout: 20_000
  })
})
