// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitGraphStashRow, GitGraphUncommittedRow } from './GitGraphAuxRows'

afterEach(cleanup)

const stash = {
  index: 0,
  oid: 'a'.repeat(40),
  message: 'WIP on main',
  createdAt: Date.UTC(2026, 0, 1)
}

describe('Git Graph auxiliary rows', () => {
  it('keeps the uncommitted row out of commit selection', () => {
    const onStash = vi.fn()
    const { getByTestId, getByRole } = render(
      <GitGraphUncommittedRow changeCount={2} onStash={onStash} />
    )
    const row = getByTestId('git-graph-aux-row')

    expect(row.getAttribute('role')).toBeNull()
    fireEvent.click(row)
    expect(onStash).not.toHaveBeenCalled()

    fireEvent.click(getByRole('button', { name: 'Stash' }))
    expect(onStash).toHaveBeenCalledTimes(1)
  })

  it('keeps stash rows out of commit selection and only offers apply', () => {
    const onApply = vi.fn()
    const { getByTestId, getByRole } = render(<GitGraphStashRow stash={stash} onApply={onApply} />)
    const row = getByTestId('git-graph-aux-row')

    expect(row.getAttribute('role')).toBeNull()
    fireEvent.click(row)
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.click(getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('labels a capped uncommitted count as a lower bound', () => {
    const { getByText } = render(
      <GitGraphUncommittedRow changeCount={1001} statusCapped onStash={vi.fn()} />
    )

    expect(getByText('Uncommitted changes (1001+)')).toBeTruthy()
  })

  it('disables actions while another graph action runs', () => {
    const { getByRole } = render(<GitGraphStashRow stash={stash} busy onApply={vi.fn()} />)

    expect(getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(true)
  })
})
