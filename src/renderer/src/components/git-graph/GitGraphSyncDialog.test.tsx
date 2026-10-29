// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitGraphSyncDialog } from './GitGraphSyncDialog'

afterEach(cleanup)

describe('GitGraphSyncDialog force push', () => {
  it('requires an explicit acknowledgment before force pushing', () => {
    const onConfirm = vi.fn()
    const { getByRole } = render(
      <GitGraphSyncDialog kind="forcePush" onCancel={vi.fn()} onConfirm={onConfirm} />
    )

    const run = getByRole('button', { name: 'Run' })
    expect(run.hasAttribute('disabled')).toBe(true)
    fireEvent.click(getByRole('checkbox'))
    expect(run.hasAttribute('disabled')).toBe(false)
    fireEvent.click(run)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not require acknowledgment for a normal push', () => {
    const { getByRole, queryByRole } = render(
      <GitGraphSyncDialog kind="push" onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    expect(queryByRole('checkbox')).toBeNull()
    expect(getByRole('button', { name: 'Run' }).hasAttribute('disabled')).toBe(false)
  })
})
