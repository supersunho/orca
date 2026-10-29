// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitGraphActionResult } from '../../../../shared/git-graph-actions'
import { useGitGraphActions } from './useGitGraphActions'

const mocks = vi.hoisted(() => ({
  runAction: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

vi.mock('@/runtime/runtime-git-graph-client', () => ({
  runRuntimeGitGraphAction: mocks.runAction
}))
vi.mock('@/lib/connection-context', () => ({ getConnectionId: () => null }))
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess }
}))

const occupiedResult: GitGraphActionResult = {
  ok: false,
  code: 'occupied-branch',
  message: 'Branch "release" is checked out in another worktree (/other).',
  occupiedWorktree: '/other'
}

afterEach(() => {
  mocks.runAction.mockReset()
  mocks.toastError.mockReset()
  mocks.toastSuccess.mockReset()
})

describe('useGitGraphActions occupied branch', () => {
  it('offers a redirect to the occupying worktree', async () => {
    mocks.runAction.mockResolvedValue(occupiedResult)
    const redirect = vi.fn()
    const onOccupiedBranch = vi.fn(() => redirect)
    const { result } = renderHook(() =>
      useGitGraphActions({
        worktreeId: 'worktree-a',
        worktreePath: '/repo',
        ownerTarget: { kind: 'local' },
        onCompleted: vi.fn(),
        onOccupiedBranch
      })
    )

    await result.current.runAction({ kind: 'checkout', branch: 'release' })

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1))
    const options = mocks.toastError.mock.calls[0]?.[1]
    options?.action?.onClick?.()
    expect(onOccupiedBranch).toHaveBeenCalledWith('/other')
    expect(redirect).toHaveBeenCalledTimes(1)
  })

  it('keeps the message-only toast when the path cannot be resolved', async () => {
    mocks.runAction.mockResolvedValue(occupiedResult)
    const { result } = renderHook(() =>
      useGitGraphActions({
        worktreeId: 'worktree-a',
        worktreePath: '/repo',
        ownerTarget: { kind: 'local' },
        onCompleted: vi.fn(),
        onOccupiedBranch: () => null
      })
    )

    await result.current.runAction({ kind: 'checkout', branch: 'release' })

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1))
    expect(mocks.toastError.mock.calls[0]?.[1]).toBeUndefined()
  })
})
