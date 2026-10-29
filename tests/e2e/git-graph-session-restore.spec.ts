import { existsSync, readFileSync } from 'node:fs'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { attachRepoAndOpenTerminal, createRestartSession } from './helpers/orca-restart'
import { ensureTerminalVisible, waitForSessionReady } from './helpers/store'
import { TEST_REPO_PATH_FILE } from './global-setup'

function seededRepoPath(): string {
  const repoPath = existsSync(TEST_REPO_PATH_FILE)
    ? readFileSync(TEST_REPO_PATH_FILE, 'utf8').trim()
    : ''
  if (!repoPath || !existsSync(repoPath)) {
    throw new Error('Git Graph restart E2E requires the seeded test repo from global setup')
  }
  return repoPath
}

async function openGitGraphTab(page: Page, worktreeId: string): Promise<string> {
  const tabId = await page.evaluate((targetWorktreeId) => {
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
    return tab.id
  }, worktreeId)

  await expect(page.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible({
    timeout: 15_000
  })
  await expect(page.locator('[data-testid="git-graph-row"]').first()).toBeVisible({
    timeout: 15_000
  })
  return tabId
}

// oxlint-disable-next-line no-empty-pattern -- this test owns both Electron launches.
test('restores a Git Graph tab after quit and relaunch', async ({}, testInfo) => {
  test.setTimeout(300_000)
  const repoPath = seededRepoPath()
  const session = createRestartSession(testInfo)
  let firstApp: ElectronApplication | null = null
  let secondApp: ElectronApplication | null = null

  try {
    const first = await session.launch()
    firstApp = first.app
    await waitForSessionReady(first.page)
    const worktreeId = await attachRepoAndOpenTerminal(first.page, repoPath)
    await ensureTerminalVisible(first.page)
    const graphTabId = await openGitGraphTab(first.page, worktreeId)

    await session.close(firstApp)
    firstApp = null

    const second = await session.launch()
    secondApp = second.app
    await waitForSessionReady(second.page)
    const restoredTab = second.page.locator(`[data-tab-id="${graphTabId}"]`)
    await expect(restoredTab).toBeVisible({ timeout: 30_000 })
    await restoredTab.click({ force: true })
    await expect(second.page.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible({
      timeout: 15_000
    })
    await expect(second.page.locator('[data-testid="git-graph-row"]').first()).toBeVisible({
      timeout: 15_000
    })
  } finally {
    for (const app of [secondApp, firstApp]) {
      if (app) {
        await session.close(app).catch(() => undefined)
      }
    }
    await session.dispose()
  }
})
