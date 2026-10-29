// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GitGraphFolderEmpty } from './GitGraphFolderEmpty'

afterEach(cleanup)

describe('GitGraphFolderEmpty', () => {
  it('explains that folder workspaces are unsupported', () => {
    const { getByText } = render(<GitGraphFolderEmpty />)

    expect(getByText('Git Graph is only available for Git worktrees.')).toBeTruthy()
  })
})
