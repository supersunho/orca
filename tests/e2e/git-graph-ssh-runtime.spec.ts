import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { createRestartSession } from './helpers/orca-restart'
import { ensureTerminalVisible, waitForSessionReady } from './helpers/store'
import {
  cleanupDockerSshHostTarget,
  DOCKER_SSH_HOST_REMOTE_REPO_PATH,
  startDockerSshHostTarget,
  type DockerSshHostTarget
} from './helpers/docker-ssh-host-target'

const TEMPLATE = process.env.ORCA_ORCAD_TEMPLATE_PATH

async function connectManagedHost(
  page: Page,
  target: DockerSshHostTarget
): Promise<{ environmentId: string }> {
  const connected = await page.evaluate(
    async (input) => {
      const { target: created } = await window.api.ssh.addTarget({ target: input })
      const state = await window.api.ssh.connect({ targetId: created.id })
      return { managedServer: state?.managedServer ?? null }
    },
    {
      label: `git graph ssh E2E ${Date.now()}`,
      host: target.host,
      port: target.port,
      username: 'root',
      identityFile: target.identityFile,
      identitiesOnly: true,
      relayGracePeriodSeconds: 1
    }
  )
  const server = connected.managedServer
  if (server?.kind !== 'managed') {
    throw new Error(`expected a managed server, got ${JSON.stringify(server)}`)
  }
  return { environmentId: server.environmentId }
}

async function addRemoteRepo(page: Page, environmentId: string, repoPath: string): Promise<void> {
  const response = await page.evaluate(
    async ({ environmentId, repoPath }) =>
      window.api.runtimeEnvironments.call({
        selector: environmentId,
        method: 'repo.add',
        params: { path: repoPath }
      }),
    { environmentId, repoPath }
  )
  if (!response.ok) {
    throw new Error(`repo.add failed: ${JSON.stringify(response.error)}`)
  }
}

async function resolveRemoteWorktree(
  page: Page,
  environmentId: string,
  repoPath: string
): Promise<string | null> {
  return page.evaluate(
    async ({ environmentId, repoPath }) => {
      const store = window.__store
      if (!store) {
        return null
      }
      await store.getState().fetchRepos({ runtimeEnvironmentId: environmentId, throwOnError: true })
      const repo = store.getState().repos.find((candidate) => candidate.path === repoPath)
      if (!repo) {
        return null
      }
      await store.getState().fetchWorktrees(repo.id)
      const worktree = (store.getState().worktreesByRepo[repo.id] ?? [])[0]
      if (!worktree) {
        return null
      }
      store.getState().setActiveWorktree(worktree.id)
      return worktree.id
    },
    { environmentId, repoPath }
  )
}

async function openGitGraphTab(page: Page, worktreeId: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) => Boolean(window.__store?.getState().groupsByWorktree[id]?.length),
          worktreeId
        ),
      { timeout: 30_000 }
    )
    .toBe(true)
  await page.evaluate((targetWorktreeId) => {
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
    const worktree = Object.values(state.worktreesByRepo)
      .flat()
      .find((candidate) => candidate.id === targetWorktreeId)
    const tab = state.createUnifiedTab(targetWorktreeId, 'git-graph', {
      label: 'Git Graph',
      targetGroupId,
      activate: true,
      ...(worktree?.hostId ? { executionHostId: worktree.hostId } : {})
    })
    store.getState().activateTab(tab.id)
    store.getState().setActiveTabType('git-graph', targetWorktreeId)
  }, worktreeId)
  await expect
    .poll(
      () =>
        page.evaluate(
          (id) =>
            (window.__store?.getState().unifiedTabsByWorktree[id] ?? []).some(
              (tab) => tab.contentType === 'git-graph'
            ),
          worktreeId
        ),
      { timeout: 30_000, message: 'Git Graph tab was not retained in the store' }
    )
    .toBe(true)
  await expect(page.getByRole('button', { name: 'Git Graph view settings' })).toBeVisible({
    timeout: 30_000
  })
  await expect(page.locator('[data-testid="git-graph-row"]').first()).toBeVisible({
    timeout: 30_000
  })
}

// oxlint-disable-next-line no-empty-pattern -- this test owns its Docker host and app.
test('loads Git Graph history from a managed SSH runtime repo', async ({}, testInfo) => {
  const template = TEMPLATE ?? ''
  test.skip(!template, 'Set ORCA_ORCAD_TEMPLATE_PATH to a matched linux orcad template')
  test.setTimeout(15 * 60_000)
  const target = startDockerSshHostTarget(testInfo)
  const session = createRestartSession(testInfo, { ORCA_ORCAD_TEMPLATE_PATH: template })
  let app: ElectronApplication | null = null
  try {
    const launched = await session.launch()
    app = launched.app
    await waitForSessionReady(launched.page)
    const { environmentId } = await connectManagedHost(launched.page, target)
    await addRemoteRepo(launched.page, environmentId, DOCKER_SSH_HOST_REMOTE_REPO_PATH)

    await expect
      .poll(
        () => resolveRemoteWorktree(launched.page, environmentId, DOCKER_SSH_HOST_REMOTE_REPO_PATH),
        { timeout: 60_000, message: 'remote repo never appeared in the renderer store' }
      )
      .not.toBeNull()
    const worktreeId = await resolveRemoteWorktree(
      launched.page,
      environmentId,
      DOCKER_SSH_HOST_REMOTE_REPO_PATH
    )
    if (!worktreeId) {
      throw new Error('remote worktree disappeared after hydration')
    }
    await ensureTerminalVisible(launched.page)
    await openGitGraphTab(launched.page, worktreeId)
  } finally {
    if (app) {
      await session.close(app)
    }
    await session.dispose()
    cleanupDockerSshHostTarget(target)
  }
})
