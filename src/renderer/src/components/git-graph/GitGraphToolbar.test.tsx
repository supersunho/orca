// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitGraphToolbar } from './GitGraphToolbar'

afterEach(cleanup)

const baseProps = {
  branchLabel: 'main',
  count: 12,
  hasMore: false,
  searchDraft: '',
  onSearchChange: vi.fn(),
  loading: false,
  onRefresh: vi.fn(),
  syncBusy: false,
  hasWorkingTreeChanges: false,
  actionBusy: false,
  stashCount: 1,
  backupCount: 0,
  viewSettings: {
    showAuthor: true,
    showDate: true,
    relativeDates: false,
    muteMerges: false
  },
  onToggleViewSetting: vi.fn(),
  onFetch: vi.fn(),
  onPull: vi.fn(),
  onPush: vi.fn(),
  onStash: vi.fn(),
  onStashes: vi.fn(),
  onBackups: vi.fn(),
  onRemotes: vi.fn()
}

describe('GitGraphToolbar stash rows toggle', () => {
  it('reflects and toggles stash row visibility', () => {
    const onToggleStashes = vi.fn()
    const { getByRole, rerender } = render(
      <GitGraphToolbar {...baseProps} stashesVisible onToggleStashes={onToggleStashes} />
    )
    const toggle = getByRole('button', { name: 'Toggle stash rows' })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle)
    expect(onToggleStashes).toHaveBeenCalledTimes(1)

    rerender(
      <GitGraphToolbar {...baseProps} stashesVisible={false} onToggleStashes={onToggleStashes} />
    )
    expect(getByRole('button', { name: 'Toggle stash rows' }).getAttribute('aria-pressed')).toBe(
      'false'
    )
  })

  it('toggles a column from the view settings menu', () => {
    const onToggleViewSetting = vi.fn()
    const { getByRole } = render(
      <GitGraphToolbar
        {...baseProps}
        stashesVisible
        onToggleStashes={vi.fn()}
        onToggleViewSetting={onToggleViewSetting}
      />
    )

    fireEvent.keyDown(getByRole('button', { name: 'Git Graph view settings' }), { key: 'Enter' })
    const item = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')
    ).find((candidate) => candidate.textContent === 'Author column')
    expect(item).toBeTruthy()
    if (item) {
      fireEvent.keyDown(item, { key: 'Enter' })
    }

    expect(onToggleViewSetting).toHaveBeenCalledWith('showAuthor')
  })
})
