// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitHistoryItemViewModel } from '../../../../shared/git-history-graph'
import { GitGraphRow } from './GitGraphRow'
import { defaultGitGraphViewSettings } from './git-graph-view-settings'

afterEach(cleanup)

function viewModel(parentIds: string[]): GitHistoryItemViewModel {
  return {
    historyItem: {
      id: 'commit-a',
      parentIds,
      subject: 'Merge branch',
      message: 'Merge branch',
      author: 'Ada',
      timestamp: Date.now()
    },
    inputSwimlanes: [],
    outputSwimlanes: [],
    kind: 'node'
  }
}

function renderRow(parentIds: string[], muteMerges: boolean) {
  return render(
    <GitGraphRow
      viewModel={viewModel(parentIds)}
      worktreeHeads={new Map()}
      viewSettings={{ ...defaultGitGraphViewSettings(), muteMerges }}
      selected={false}
      activeRefFilter={[]}
      onSelect={vi.fn()}
      onToggleRefFilter={vi.fn()}
    />
  )
}

describe('GitGraphRow merge muting', () => {
  it('keeps merge rows visible and marks them muted', () => {
    const { getByTestId } = renderRow(['parent-a', 'parent-b'], true)

    expect(getByTestId('git-graph-row').getAttribute('data-muted-merge')).toBe('true')
  })

  it('does not mute non-merge commits', () => {
    const { getByTestId } = renderRow(['parent-a'], true)

    expect(getByTestId('git-graph-row').getAttribute('data-muted-merge')).toBeNull()
  })
})
