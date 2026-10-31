import { describe, expect, it } from 'vitest'
import { GitHistory } from './git-params'

// The renderer sends includeRemoteRefs through git.history RPC; the Zod schema
// must not strip it before pickGitHistoryOptions normalizes the query.
describe('GitHistory RPC params', () => {
  it('preserves includeRemoteRefs=false at the RPC boundary', () => {
    const parsed = GitHistory.parse({
      worktree: 'repo-1::/repo',
      allRefs: true,
      includeRemoteRefs: false
    })
    expect(parsed.includeRemoteRefs).toBe(false)
  })

  it('preserves includeRemoteRefs=true at the RPC boundary', () => {
    const parsed = GitHistory.parse({
      worktree: 'repo-1::/repo',
      allRefs: true,
      includeRemoteRefs: true
    })
    expect(parsed.includeRemoteRefs).toBe(true)
  })

  it('keeps the field optional for callers that omit it', () => {
    const parsed = GitHistory.parse({ worktree: 'repo-1::/repo', allRefs: true })
    expect(parsed.includeRemoteRefs).toBeUndefined()
  })
})
