// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitGraphWebUnsupported } from './GitGraphWebUnsupported'

afterEach(cleanup)

describe('GitGraphWebUnsupported', () => {
  it('closes the unsupported Git Graph tab', () => {
    const onClose = vi.fn()
    const { getByRole } = render(<GitGraphWebUnsupported onClose={onClose} />)

    fireEvent.click(getByRole('button', { name: 'Close Git Graph' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
