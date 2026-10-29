import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitHistoryResult } from '../../../shared/git-history'

type Handler = (event: unknown, args: unknown) => unknown

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler)
    }),
    getHistory: vi.fn(),
    resolveRegisteredWorktreePath: vi.fn(),
    getLocalGitOptionsForRegisteredWorktree: vi.fn(),
    requireReachableGitRoute: vi.fn(),
    getConnectionExecutionHostId: vi.fn(),
    store: {}
  }
})

vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle } }))
vi.mock('../../git/history', () => ({ getHistory: mocks.getHistory }))
vi.mock('../registered-worktree-roots-cache', () => ({
  resolveRegisteredWorktreePath: mocks.resolveRegisteredWorktreePath
}))
vi.mock('../local-worktree-runtime-options', () => ({
  getLocalGitOptionsForRegisteredWorktree: mocks.getLocalGitOptionsForRegisteredWorktree,
  getLocalGitOptionsForRepo: vi.fn(),
  getLocalRepoForRegisteredWorktree: vi.fn()
}))
vi.mock('../../providers/execution-host-provider-dispatch', () => ({
  requireReachableGitRoute: mocks.requireReachableGitRoute
}))
vi.mock('../../../shared/execution-host', () => ({
  getConnectionExecutionHostId: mocks.getConnectionExecutionHostId
}))

import { createFilesystemHandlerContext } from './filesystem-handler-context'
import { registerFilesystemGitStatusHandlers } from './filesystem-git-status-handlers'
import type { Store } from '../../persistence/loading-store/store'
import type { SenderScopedRequestCancellations } from '../sender-scoped-request-cancellation'

const cancellations: SenderScopedRequestCancellations = {
  begin: vi.fn(() => null),
  finish: vi.fn(),
  cancel: vi.fn()
}

function getHistoryHandler(): Handler {
  const handler = mocks.handlers.get('git:history')
  if (!handler) {
    throw new Error('git:history handler not registered')
  }
  return handler
}

beforeEach(() => {
  mocks.handlers.clear()
  mocks.handle.mockClear()
  mocks.getHistory.mockReset().mockResolvedValue({
    items: [],
    hasIncomingChanges: false,
    hasOutgoingChanges: false,
    hasMore: false,
    limit: 300,
    scope: 'all-refs'
  } satisfies GitHistoryResult)
  mocks.resolveRegisteredWorktreePath.mockReset().mockResolvedValue('/repo')
  mocks.getLocalGitOptionsForRegisteredWorktree.mockReset().mockReturnValue({
    admissionTier: 'interactive'
  })
  mocks.requireReachableGitRoute.mockReset()
  mocks.getConnectionExecutionHostId.mockReset().mockReturnValue('local')

  const context = createFilesystemHandlerContext(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the history handler only passes the store to mocked resolvers.
    mocks.store as Store,
    undefined,
    cancellations,
    cancellations
  )
  registerFilesystemGitStatusHandlers(context)
})

describe('git:history local IPC boundary', () => {
  it('preserves allRefs, refFilter, search, and paging for the loader', async () => {
    const handler = getHistoryHandler()

    const history = await handler(
      {},
      {
        worktreePath: '/repo',
        allRefs: true,
        refFilter: ['refs/heads/main', 'refs/tags/v1'],
        search: 'fix',
        limit: 300,
        skip: 100
      }
    )

    expect(history).toMatchObject({ scope: 'all-refs' })
    expect(mocks.resolveRegisteredWorktreePath).toHaveBeenCalledWith('/repo', mocks.store)
    expect(mocks.getHistory).toHaveBeenCalledWith('/repo', {
      allRefs: true,
      refFilter: ['refs/heads/main', 'refs/tags/v1'],
      search: 'fix',
      limit: 300,
      skip: 100,
      admissionTier: 'interactive'
    })
  })

  it('drops flag-like and short ref filters before the loader', async () => {
    await getHistoryHandler()(
      {},
      {
        worktreePath: '/repo',
        allRefs: true,
        refFilter: ['--all', 'main', 'refs/heads/main', 'refs/heads/main']
      }
    )

    expect(mocks.getHistory).toHaveBeenCalledWith('/repo', {
      allRefs: true,
      refFilter: ['refs/heads/main'],
      admissionTier: 'interactive'
    })
  })
})
