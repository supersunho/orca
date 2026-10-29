// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitGraphActionDialog } from './GitGraphActionDialog'

afterEach(cleanup)

describe('GitGraphActionDialog destructive confirmation', () => {
  it('requires the acknowledgment before running a drop', () => {
    const onConfirm = vi.fn()
    const { getByRole } = render(
      <GitGraphActionDialog
        request={{
          kind: 'confirm',
          title: 'Drop commit',
          description: 'Remove this commit.',
          acknowledge: 'I understand this rewrites the current branch.',
          action: { kind: 'dropCommit', commit: 'abc1234' }
        }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    const run = getByRole('button', { name: 'Run' })
    expect(run.hasAttribute('disabled')).toBe(true)

    fireEvent.click(getByRole('checkbox'))
    expect(run.hasAttribute('disabled')).toBe(false)
    fireEvent.click(run)
    expect(onConfirm).toHaveBeenCalledWith({ kind: 'dropCommit', commit: 'abc1234' })
  })

  it('requires a fresh acknowledgment when the request changes', () => {
    const { getByRole, rerender } = render(
      <GitGraphActionDialog
        key="drop-abc1234"
        request={{
          kind: 'confirm',
          title: 'Drop commit',
          description: 'Remove this commit.',
          acknowledge: 'I understand this rewrites the current branch.',
          action: { kind: 'dropCommit', commit: 'abc1234' }
        }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    fireEvent.click(getByRole('checkbox'))
    expect(getByRole('button', { name: 'Run' }).hasAttribute('disabled')).toBe(false)

    rerender(
      <GitGraphActionDialog
        key="drop-def5678"
        request={{
          kind: 'confirm',
          title: 'Drop commit',
          description: 'Remove another commit.',
          acknowledge: 'I understand this rewrites the current branch.',
          action: { kind: 'dropCommit', commit: 'def5678' }
        }}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(getByRole('button', { name: 'Run' }).hasAttribute('disabled')).toBe(true)
  })
})
