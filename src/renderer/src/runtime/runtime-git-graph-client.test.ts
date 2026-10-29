// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runRuntimeGitGraphAction, getRuntimeGitGraphAuxRefs } from './runtime-git-graph-client'

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  graphAction: vi.fn(),
  graphAuxRefs: vi.fn()
}))

vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))

afterEach(() => {
  mocks.callRuntimeRpc.mockReset()
  mocks.graphAction.mockReset()
  mocks.graphAuxRefs.mockReset()
  vi.unstubAllGlobals()
})

describe('runtime git graph client', () => {
  it('routes local actions through the preload graph API', async () => {
    vi.stubGlobal('api', {
      git: { graphAction: mocks.graphAction, graphAuxRefs: mocks.graphAuxRefs }
    })
    mocks.graphAction.mockResolvedValue({ ok: true })

    await runRuntimeGitGraphAction(
      { target: { kind: 'local' }, worktreeId: 'worktree-a', worktreePath: '/repo' },
      { kind: 'checkout', branch: 'main' }
    )

    expect(mocks.graphAction).toHaveBeenCalledWith({
      worktreePath: '/repo',
      connectionId: undefined,
      action: { kind: 'checkout', branch: 'main' }
    })
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })

  it('routes environment actions through git.graphAction RPC', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ ok: true })
    const target = { kind: 'environment' as const, environmentId: 'env-1' }

    await runRuntimeGitGraphAction(
      { target, worktreeId: 'ssh:host::/repo', worktreePath: '/repo' },
      { kind: 'checkout', branch: 'main' }
    )

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      target,
      'git.graphAction',
      {
        worktree: 'id:ssh:host::/repo',
        action: { kind: 'checkout', branch: 'main' }
      },
      { timeoutMs: 30_000 }
    )
  })

  it('routes aux refs through the environment RPC', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ stashes: [], backups: [] })
    const target = { kind: 'environment' as const, environmentId: 'env-1' }

    await getRuntimeGitGraphAuxRefs({ target, worktreeId: 'wt', worktreePath: '/repo' })

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      target,
      'git.graphAuxRefs',
      { worktree: 'id:wt' },
      { timeoutMs: 15_000 }
    )
  })
})
