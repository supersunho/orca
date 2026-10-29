// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGitGraphMenuHandlers } from './useGitGraphMenuHandlers'

describe('useGitGraphMenuHandlers checkout', () => {
  it('routes checkout through a confirmation dialog', () => {
    const setDialogRequest = vi.fn()
    const { result } = renderHook(() =>
      useGitGraphMenuHandlers({
        setDialogRequest,
        setSelectedIds: vi.fn()
      })
    )

    result.current.onCheckoutCommit('main')

    expect(setDialogRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'confirm',
        action: { kind: 'checkout', branch: 'main' }
      })
    )
  })
})
