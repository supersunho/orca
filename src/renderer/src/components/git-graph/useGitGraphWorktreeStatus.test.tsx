// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitStatusResult } from '../../../../shared/git-status-types'

const mocks = vi.hoisted(() => ({
  getRuntimeGitStatus: vi.fn()
}))

vi.mock('@/runtime/runtime-git-status-client', () => ({
  getRuntimeGitStatus: mocks.getRuntimeGitStatus
}))
vi.mock('@/lib/connection-context', () => ({
  getConnectionId: () => undefined
}))

import { useGitGraphWorktreeStatus } from './useGitGraphWorktreeStatus'

afterEach(() => {
  cleanup()
  mocks.getRuntimeGitStatus.mockReset()
})

const localTarget = { kind: 'local' as const }

function status(overrides: Partial<GitStatusResult> = {}): GitStatusResult {
  return {
    entries: [],
    conflictOperation: 'unknown',
    ...overrides
  }
}

describe('useGitGraphWorktreeStatus', () => {
  it('surfaces a read error without claiming a clean worktree', async () => {
    mocks.getRuntimeGitStatus.mockResolvedValue(
      status({ readError: 'index locked', didHitLimit: true, statusLength: 4 })
    )
    const { result } = renderHook(() =>
      useGitGraphWorktreeStatus({
        worktreeId: 'worktree-a',
        worktreePath: '/repo/a',
        ownerTarget: localTarget,
        refreshKey: null,
        conflict: null
      })
    )

    await waitFor(() => expect(result.current.statusReadError).toBe('index locked'))
    expect(result.current.hasWorkingTreeChanges).toBe(false)
    expect(result.current.workingTreeChangeCount).toBe(0)
    expect(result.current.statusCapped).toBe(false)
  })

  it('surfaces a rejected status request as a read error', async () => {
    mocks.getRuntimeGitStatus.mockRejectedValue(new Error('status timed out'))
    const { result } = renderHook(() =>
      useGitGraphWorktreeStatus({
        worktreeId: 'worktree-a',
        worktreePath: '/repo/a',
        ownerTarget: localTarget,
        refreshKey: null,
        conflict: null
      })
    )

    await waitFor(() => expect(result.current.statusReadError).toBe('status timed out'))
    expect(result.current.hasWorkingTreeChanges).toBe(false)
    expect(result.current.workingTreeChangeCount).toBe(0)
  })

  it('drops the previous worktree status while the next request is pending', async () => {
    const pending = new Promise<GitStatusResult>(() => {})
    mocks.getRuntimeGitStatus.mockImplementation((context: { worktreePath: string }) =>
      context.worktreePath === '/repo/a'
        ? Promise.resolve(
            status({
              entries: [{ path: 'dirty.ts', status: 'modified', area: 'unstaged' }]
            })
          )
        : pending
    )
    const { result, rerender } = renderHook(
      ({ worktreePath }: { worktreePath: string }) =>
        useGitGraphWorktreeStatus({
          worktreeId: worktreePath === '/repo/a' ? 'worktree-a' : 'worktree-b',
          worktreePath,
          ownerTarget: localTarget,
          refreshKey: null,
          conflict: null
        }),
      { initialProps: { worktreePath: '/repo/a' } }
    )

    await waitFor(() => expect(result.current.workingTreeChangeCount).toBe(1))
    rerender({ worktreePath: '/repo/b' })

    expect(result.current.worktreeStatus).toBeNull()
    expect(result.current.hasWorkingTreeChanges).toBe(false)
    expect(result.current.workingTreeChangeCount).toBe(0)
    expect(result.current.conflictEntries).toEqual([])
  })

  it('aborts the previous status request when the worktree changes', async () => {
    const signals: { path: string; signal: AbortSignal }[] = []
    mocks.getRuntimeGitStatus.mockImplementation(
      (context: { worktreePath: string }, options?: { signal?: AbortSignal }) => {
        if (options?.signal) {
          signals.push({ path: context.worktreePath, signal: options.signal })
        }
        return new Promise<GitStatusResult>(() => {})
      }
    )
    const { rerender } = renderHook(
      ({ worktreePath }: { worktreePath: string }) =>
        useGitGraphWorktreeStatus({
          worktreeId: worktreePath === '/repo/a' ? 'worktree-a' : 'worktree-b',
          worktreePath,
          ownerTarget: localTarget,
          refreshKey: null,
          conflict: null
        }),
      { initialProps: { worktreePath: '/repo/a' } }
    )

    await waitFor(() => expect(signals).toHaveLength(1))
    rerender({ worktreePath: '/repo/b' })
    expect(signals[0]?.signal.aborted).toBe(true)
    act(() => {})
  })
})
