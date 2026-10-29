import { describe, expect, it } from 'vitest'
import {
  clampGitHistorySkip,
  gitHistoryScopeForOptions,
  normalizeGitHistoryRefFilter,
  normalizeGitHistorySearch,
  pickGitHistoryOptions
} from './git-history-options'

describe('git history options', () => {
  it('picks only known fields from a transport payload', () => {
    const payload: Record<string, unknown> = {
      limit: 300,
      skip: 100,
      baseRef: 'main',
      allRefs: true,
      search: '  fix: parser  ',
      refFilter: ['refs/heads/main'],
      worktreePath: '/repo',
      connectionId: 'ssh-1'
    }

    expect(pickGitHistoryOptions(payload)).toEqual({
      limit: 300,
      skip: 100,
      baseRef: 'main',
      allRefs: true,
      search: 'fix: parser',
      refFilter: ['refs/heads/main']
    })
  })

  it('drops invalid ref filters and keeps full ref names only', () => {
    expect(
      normalizeGitHistoryRefFilter([
        'refs/heads/main',
        'main',
        '--all',
        'refs/tags/v1.0.0',
        'refs/heads/main'
      ])
    ).toEqual(['refs/heads/main', 'refs/tags/v1.0.0'])
    expect(normalizeGitHistoryRefFilter(['main', '--all'])).toBeUndefined()
    expect(normalizeGitHistoryRefFilter([])).toBeUndefined()
  })

  it('trims and bounds search text', () => {
    expect(normalizeGitHistorySearch('   ')).toBeUndefined()
    expect(normalizeGitHistorySearch('  fix  ')).toBe('fix')
    expect(normalizeGitHistorySearch('x'.repeat(600))).toHaveLength(500)
  })

  it('clamps skip to a non-negative integer', () => {
    expect(clampGitHistorySkip(undefined)).toBe(0)
    expect(clampGitHistorySkip(-10)).toBe(0)
    expect(clampGitHistorySkip(12.9)).toBe(12)
    expect(clampGitHistorySkip(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampGitHistorySkip(100)).toBe(100)
  })

  it('derives the query scope from allRefs', () => {
    expect(gitHistoryScopeForOptions({})).toBe('head')
    expect(gitHistoryScopeForOptions({ allRefs: false })).toBe('head')
    expect(gitHistoryScopeForOptions({ allRefs: true })).toBe('all-refs')
  })
})
