// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitHistoryResult } from '../../../../shared/git-history'

const mocks = vi.hoisted(() => ({
  getRuntimeGitHistory: vi.fn()
}))

vi.mock('@/runtime/runtime-git-status-client', () => ({
  getRuntimeGitHistory: mocks.getRuntimeGitHistory
}))
vi.mock('@/lib/connection-context', () => ({
  getConnectionId: () => undefined
}))

import { useGitGraphHistory } from './useGitGraphHistory'

afterEach(() => {
  cleanup()
  mocks.getRuntimeGitHistory.mockReset()
})

const localTarget = { kind: 'local' as const }

function result(count: number, overrides: Partial<GitHistoryResult> = {}): GitHistoryResult {
  return {
    items: Array.from({ length: count }, (_, index) => ({
      id: `commit-${index}`,
      parentIds: [],
      subject: `commit ${index}`,
      message: `commit ${index}`
    })),
    hasIncomingChanges: false,
    hasOutgoingChanges: false,
    hasMore: false,
    limit: count,
    scope: 'all-refs',
    ...overrides
  }
}

function renderHistory(worktreeId = 'worktree-a') {
  return renderHook(
    ({ id }: { id: string }) =>
      useGitGraphHistory({
        worktreeId: id,
        worktreePath: `/repo/${id}`,
        ownerTarget: localTarget
      }),
    { initialProps: { id: worktreeId } }
  )
}

describe('useGitGraphHistory', () => {
  it('loads 300 initially and 100 more per page', async () => {
    mocks.getRuntimeGitHistory
      .mockResolvedValueOnce(result(300, { hasMore: true }))
      .mockResolvedValueOnce(result(100, { hasMore: false, skip: 300, limit: 100 }))
    const { result: hook } = renderHistory()

    await waitFor(() => expect(hook.current.result?.items).toHaveLength(300))
    expect(mocks.getRuntimeGitHistory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ worktreeId: 'worktree-a' }),
      expect.objectContaining({ allRefs: true, limit: 300 }),
      expect.any(Object)
    )

    await act(async () => {
      await hook.current.loadMore()
    })

    expect(hook.current.result?.items).toHaveLength(400)
    expect(mocks.getRuntimeGitHistory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ worktreeId: 'worktree-a' }),
      expect.objectContaining({ allRefs: true, limit: 100, skip: 300 }),
      expect.any(Object)
    )
  })

  it('does not load past the 5,000 commit cap', async () => {
    mocks.getRuntimeGitHistory.mockResolvedValueOnce(result(5_000, { hasMore: true }))
    const { result: hook } = renderHistory()

    await waitFor(() => expect(hook.current.result?.items).toHaveLength(5_000))
    await act(async () => {
      await hook.current.loadMore()
    })

    expect(mocks.getRuntimeGitHistory).toHaveBeenCalledTimes(1)
  })

  it('aborts the previous history request when the worktree changes', async () => {
    const signals: AbortSignal[] = []
    mocks.getRuntimeGitHistory.mockImplementation(
      (_context: unknown, _options: unknown, transport: { signal?: AbortSignal }) => {
        if (transport.signal) {
          signals.push(transport.signal)
        }
        return new Promise<GitHistoryResult>(() => {})
      }
    )
    const { rerender } = renderHistory('worktree-a')

    await waitFor(() => expect(signals).toHaveLength(1))
    rerender({ id: 'worktree-b' })
    await waitFor(() => expect(signals[0]?.aborted).toBe(true))
  })
})
