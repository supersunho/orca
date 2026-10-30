import { describe, expect, it } from 'vitest'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { showsGitGraphEntry } from './TabGroupPanel'

describe('Git Graph create-menu gate', () => {
  it('shows the entry for a real git worktree id (repoId::path, the store format)', () => {
    expect(showsGitGraphEntry('repo-1::/Users/dev/orca')).toBe(true)
  })

  it('shows the entry for a scoped worktree key', () => {
    expect(showsGitGraphEntry('worktree:repo-1::/Users/dev/orca')).toBe(true)
  })

  it('hides the entry for a folder workspace id', () => {
    expect(showsGitGraphEntry('folder:abc')).toBe(false)
  })

  it('does not hide the entry for unrecognized id shapes', () => {
    // Why: TabGroupPanel only renders for a mounted git worktree, so its id is
    // trusted; parseWorkspaceKey returns null for the bare `repoId::path` form.
    expect(showsGitGraphEntry('')).toBe(true)
    expect(showsGitGraphEntry('not-a-worktree')).toBe(true)
  })
})

// Documents the shared key parser contract the gate depends on.
describe('parseWorkspaceKey contract', () => {
  it('returns null for a git worktree id (repoId::path)', () => {
    expect(parseWorkspaceKey('repo-1::/Users/dev/orca')).toBeNull()
  })
})
