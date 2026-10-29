// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GitHistoryResult } from '../../../../shared/git-history'
import { GitGraphOldRuntimeBanner, isOldRuntimeHistory } from './GitGraphOldRuntimeBanner'

afterEach(cleanup)

function result(scope: GitHistoryResult['scope']): GitHistoryResult {
  return {
    items: [],
    hasIncomingChanges: false,
    hasOutgoingChanges: false,
    hasMore: false,
    limit: 300,
    scope
  }
}

describe('Git Graph old-runtime fallback', () => {
  it('treats a head or missing scope as an old runtime', () => {
    expect(isOldRuntimeHistory(result('head'))).toBe(true)
    expect(isOldRuntimeHistory(result(undefined))).toBe(true)
    expect(isOldRuntimeHistory(result('all-refs'))).toBe(false)
    expect(isOldRuntimeHistory(null)).toBe(false)
  })

  it('renders the all-branch unsupported message', () => {
    const { getByText } = render(<GitGraphOldRuntimeBanner />)

    expect(
      getByText(
        'This runtime does not support the all-branch graph. Showing the current branch only.'
      )
    ).toBeTruthy()
  })
})
