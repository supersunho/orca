import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown, args: unknown) => unknown

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler)
    }),
    runGitGraphActionWithStashLock: vi.fn(),
    listGraphAuxRefs: vi.fn(),
    assertWslUncPathRunning: vi.fn(),
    requireReachableGitRoute: vi.fn(),
    getConnectionExecutionHostId: vi.fn(),
    resolveRegisteredWorktreePath: vi.fn(),
    getLocalGitOptionsForRegisteredWorktree: vi.fn(),
    store: {}
  }
})

vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle } }))
vi.mock('../../../git/graph-action-lock', () => ({
  runGitGraphActionWithStashLock: mocks.runGitGraphActionWithStashLock
}))
vi.mock('../../../git/graph-aux-refs', () => ({ listGraphAuxRefs: mocks.listGraphAuxRefs }))
vi.mock('../../../wsl/wsl-unc-access-gate', () => ({
  assertWslUncPathRunning: mocks.assertWslUncPathRunning
}))
vi.mock('../../../providers/execution-host-provider-dispatch', () => ({
  requireReachableGitRoute: mocks.requireReachableGitRoute
}))
vi.mock('../../../../shared/execution-host', () => ({
  getConnectionExecutionHostId: mocks.getConnectionExecutionHostId
}))
vi.mock('../../registered-worktree-roots-cache', () => ({
  resolveRegisteredWorktreePath: mocks.resolveRegisteredWorktreePath
}))
vi.mock('../../local-worktree-runtime-options', () => ({
  getLocalGitOptionsForRegisteredWorktree: mocks.getLocalGitOptionsForRegisteredWorktree
}))

import { createFilesystemHandlerContext } from '../filesystem-handler-context'
import type { Store } from '../../../persistence/loading-store/store'
import type { SenderScopedRequestCancellations } from '../../sender-scoped-request-cancellation'
import { registerGitGraphActionHandlers } from './graph-action-handlers'

const cancellations: SenderScopedRequestCancellations = {
  begin: vi.fn(() => null),
  finish: vi.fn(),
  cancel: vi.fn()
}

function getGraphActionHandler(): Handler {
  const handler = mocks.handlers.get('git:graphAction')
  if (!handler) {
    throw new Error('git:graphAction handler not registered')
  }
  return handler
}

beforeEach(() => {
  mocks.handlers.clear()
  mocks.handle.mockClear()
  mocks.runGitGraphActionWithStashLock.mockReset().mockResolvedValue({ ok: true })
  mocks.listGraphAuxRefs.mockReset().mockResolvedValue({ stashes: [], backups: [] })
  mocks.assertWslUncPathRunning.mockReset().mockResolvedValue(undefined)
  mocks.requireReachableGitRoute.mockReset()
  mocks.getConnectionExecutionHostId.mockReset().mockReturnValue('local')
  mocks.resolveRegisteredWorktreePath.mockReset().mockResolvedValue('/repo')
  mocks.getLocalGitOptionsForRegisteredWorktree.mockReset().mockReturnValue({
    admissionTier: 'interactive'
  })
  const context = createFilesystemHandlerContext(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: graph action handlers only pass the store to mocked resolvers.
    mocks.store as Store,
    undefined,
    cancellations,
    cancellations
  )
  registerGitGraphActionHandlers(context)
})

const invalidActions = [
  {
    name: 'a non-boolean force',
    action: { kind: 'deleteBranch', name: 'main', force: 'false' }
  },
  {
    name: 'an unknown field',
    action: { kind: 'deleteBranch', name: 'main', force: false, extra: true }
  }
]

describe('git:graphAction IPC boundary', () => {
  for (const { name, action } of invalidActions) {
    it(`rejects ${name} before any route, worktree, or dispatch side effect`, async () => {
      const result = await getGraphActionHandler()({}, { worktreePath: '/repo', action })

      expect(result).toEqual({
        ok: false,
        code: 'invalid-input',
        message: 'Invalid graph action.'
      })
      expect(mocks.requireReachableGitRoute).not.toHaveBeenCalled()
      expect(mocks.assertWslUncPathRunning).not.toHaveBeenCalled()
      expect(mocks.resolveRegisteredWorktreePath).not.toHaveBeenCalled()
      expect(mocks.runGitGraphActionWithStashLock).not.toHaveBeenCalled()
    })
  }

  it('forwards a valid action after strict parsing', async () => {
    const action = { kind: 'deleteBranch', name: 'main', force: false }
    const result = await getGraphActionHandler()({}, { worktreePath: '/repo', action })

    expect(result).toEqual({ ok: true })
    expect(mocks.resolveRegisteredWorktreePath).toHaveBeenCalledWith('/repo', mocks.store)
    expect(mocks.runGitGraphActionWithStashLock).toHaveBeenCalledWith('/repo', action, {
      admissionTier: 'interactive'
    })
  })
})
