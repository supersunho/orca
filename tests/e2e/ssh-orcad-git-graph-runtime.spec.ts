import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { createRestartSession } from './helpers/orca-restart'
import { ensureTerminalVisible, waitForSessionReady } from './helpers/store'
import type { GitGraphAction, GitGraphActionResult } from '../../src/shared/git-graph-actions'
import {
  cleanupDockerSshHostTarget,
  DOCKER_SSH_HOST_REMOTE_REPO_PATH,
  execDockerSshHostTargetCommand,
  startDockerSshHostTarget,
  type DockerSshHostTarget
} from './helpers/docker-ssh-host-target'

const TEMPLATE = process.env.ORCA_ORCAD_TEMPLATE_PATH

function assertGitGraphActionResult(value: unknown): asserts value is GitGraphActionResult {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('ok' in value) ||
    typeof value.ok !== 'boolean'
  ) {
    throw new Error('git.graphAction returned an invalid result')
  }
}
async function runRemoteGitRpc(
  page: Page,
  environmentId: string,
  worktreeId: string,
  method: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  const response = await page.evaluate(
    async ({ environmentId, worktreeId, method, params }) =>
      window.api.runtimeEnvironments.call({
        selector: environmentId,
        method,
        params: { worktree: `id:${worktreeId}`, ...params }
      }),
    { environmentId, worktreeId, method, params }
  )
  if (!response.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(response.error)}`)
  }
}

async function runRemoteGraphAction(
  page: Page,
  environmentId: string,
  worktreeId: string,
  action: GitGraphAction
): Promise<GitGraphActionResult> {
  const response = await page.evaluate(
    async ({ environmentId, worktreeId, action }) =>
      window.api.runtimeEnvironments.call({
        selector: environmentId,
        method: 'git.graphAction',
        params: { worktree: `id:${worktreeId}`, action }
      }),
    { environmentId, worktreeId, action }
  )
  if (!response.ok) {
    throw new Error(`SSH graph action failed: ${JSON.stringify(response.error)}`)
  }
  assertGitGraphActionResult(response.result)
  return response.result
}

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
      return worktree?.id ?? null
    },
    { environmentId, repoPath }
  )
}

async function openGitGraphTab(page: Page, worktreeId: string): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate((targetWorktreeId) => {
          const store = window.__store
          if (!store) {
            return
          }
          const state = store.getState()
          const targetGroupId =
            state.activeGroupIdByWorktree[targetWorktreeId] ??
            state.groupsByWorktree[targetWorktreeId]?.[0]?.id
          if (!targetGroupId) {
            return
          }
          const existing = (state.unifiedTabsByWorktree[targetWorktreeId] ?? []).find(
            (tab) => tab.contentType === 'git-graph'
          )
          const worktree = Object.values(state.worktreesByRepo)
            .flat()
            .find((candidate) => candidate.id === targetWorktreeId)
          const tab =
            existing ??
            state.createUnifiedTab(targetWorktreeId, 'git-graph', {
              label: 'Git Graph',
              targetGroupId,
              activate: true,
              ...(worktree?.hostId ? { executionHostId: worktree.hostId } : {})
            })
          store.getState().activateTab(tab.id)
          store.getState().setActiveTabType('git-graph', targetWorktreeId)
        }, worktreeId)
        return page.getByRole('button', { name: 'Git Graph view settings' }).isVisible()
      },
      { timeout: 60_000, intervals: [500, 1_000, 2_000] }
    )
    .toBe(true)
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
    await launched.page.evaluate((id) => {
      window.__store?.getState().setActiveWorktree(id)
    }, worktreeId)
    await ensureTerminalVisible(launched.page)
    await openGitGraphTab(launched.page, worktreeId)
    await expect(launched.page.getByText('initial', { exact: true })).toBeVisible({
      timeout: 30_000
    })

    const remoteGit = (args: string): string =>
      execDockerSshHostTargetCommand(
        target,
        `git -C ${DOCKER_SSH_HOST_REMOTE_REPO_PATH} ${args}`
      ).trim()

    const tagName = `e2e-graph-${Date.now()}`
    const tagResult = await runRemoteGraphAction(launched.page, environmentId, worktreeId, {
      kind: 'createTag',
      name: tagName,
      target: 'HEAD',
      push: false
    })
    if (!tagResult.ok) {
      throw new Error(`SSH tag action rejected: ${tagResult.message}`)
    }
    expect(remoteGit(`tag --list ${tagName}`)).toBe(tagName)

    const branchName = `e2e-branch-${Date.now()}`
    const branchResult = await runRemoteGraphAction(launched.page, environmentId, worktreeId, {
      kind: 'createBranch',
      name: branchName,
      startPoint: 'HEAD',
      checkout: false
    })
    if (!branchResult.ok) {
      throw new Error(`SSH branch create rejected: ${branchResult.message}`)
    }
    expect(remoteGit(`branch --list ${branchName}`)).toContain(branchName)

    const deleteResult = await runRemoteGraphAction(launched.page, environmentId, worktreeId, {
      kind: 'deleteBranch',
      name: branchName,
      force: false
    })
    if (!deleteResult.ok) {
      throw new Error(`SSH branch delete rejected: ${deleteResult.message}`)
    }
    expect(remoteGit(`branch --list ${branchName}`)).toBe('')

    execDockerSshHostTargetCommand(
      target,
      `printf 'stash change\\n' >> ${DOCKER_SSH_HOST_REMOTE_REPO_PATH}/README.md`
    )
    const stashResult = await runRemoteGraphAction(launched.page, environmentId, worktreeId, {
      kind: 'stashCreate',
      includeUntracked: false
    })
    if (!stashResult.ok) {
      throw new Error(`SSH stash create rejected: ${stashResult.message}`)
    }
    expect(remoteGit('stash list')).not.toBe('')
    const applyResult = await runRemoteGraphAction(launched.page, environmentId, worktreeId, {
      kind: 'stashApply',
      index: 0,
      reinstateIndex: false
    })
    if (!applyResult.ok) {
      throw new Error(`SSH stash apply rejected: ${applyResult.message}`)
    }
    expect(remoteGit('status --porcelain')).toContain('README.md')
    remoteGit('reset --hard HEAD')

    const originPath = '/tmp/orca-e2e-origin.git'
    execDockerSshHostTargetCommand(target, `rm -rf ${originPath} && git init --bare ${originPath}`)
    remoteGit(`push ${originPath} HEAD:refs/heads/master`)
    const remoteAddResult = await runRemoteGraphAction(launched.page, environmentId, worktreeId, {
      kind: 'remoteAdd',
      name: 'e2e-origin',
      url: `file://${originPath}`
    })
    if (!remoteAddResult.ok) {
      throw new Error(`SSH remote add rejected: ${remoteAddResult.message}`)
    }
    expect(remoteGit('remote')).toContain('e2e-origin')
    await runRemoteGitRpc(launched.page, environmentId, worktreeId, 'git.fetch')
    const seededBranch = remoteGit('branch --show-current')
    expect(remoteGit('branch -r')).toContain(`e2e-origin/${seededBranch}`)
    await runRemoteGitRpc(launched.page, environmentId, worktreeId, 'git.push', {
      pushTarget: { remoteName: 'e2e-origin', branchName: seededBranch }
    })
    expect(
      execDockerSshHostTargetCommand(target, `git -C ${originPath} log -1 --format=%s`).trim()
    ).toBe('initial')
    execDockerSshHostTargetCommand(
      target,
      `git clone ${originPath} /tmp/orca-e2e-origin-work && ` +
        `cd /tmp/orca-e2e-origin-work && git config user.email e2e@test.local && ` +
        `git config user.name e2e && printf 'remote change\\n' >> README.md && ` +
        `git commit -am 'remote change' && git push origin ${seededBranch}`
    )
    remoteGit(`branch --set-upstream-to=e2e-origin/${seededBranch} ${seededBranch}`)
    await runRemoteGitRpc(launched.page, environmentId, worktreeId, 'git.pull')
    expect(remoteGit('log -1 --format=%s')).toBe('remote change')
    const remoteRemoveResult = await runRemoteGraphAction(
      launched.page,
      environmentId,
      worktreeId,
      { kind: 'remoteRemove', name: 'e2e-origin' }
    )
    if (!remoteRemoveResult.ok) {
      throw new Error(`SSH remote remove rejected: ${remoteRemoveResult.message}`)
    }
    expect(remoteGit('remote')).not.toContain('e2e-origin')
  } finally {
    if (app) {
      await session.close(app)
    }
    await session.dispose()
    cleanupDockerSshHostTarget(target)
  }
})
