import { describe, expect, it } from 'vitest'
import { findOccupiedWorktree } from './git-graph-occupied-worktree'

const local = { id: 'wt-a', repoId: 'repo-a', path: '/repo/feature' }
const localNormalized = { id: 'wt-b', repoId: 'repo-a', path: '/repo//feature/' }
const otherHost = {
  id: 'wt-c',
  repoId: 'repo-a',
  hostId: 'ssh:host-b' as const,
  path: '/repo/feature'
}
const windows = {
  id: 'wt-d',
  repoId: 'repo-a',
  hostId: 'local' as const,
  path: 'C:\\Repo\\Feature'
}

describe('findOccupiedWorktree', () => {
  it('matches normalized equivalent paths', () => {
    expect(
      findOccupiedWorktree([local, localNormalized], '/repo//feature/', {
        repoId: 'repo-a',
        hostId: undefined
      })?.id
    ).toBe('wt-a')
  })

  it('matches Windows path case and separators', () => {
    expect(
      findOccupiedWorktree([windows], 'c:/repo/feature', {
        repoId: 'repo-a',
        hostId: 'local'
      })?.id
    ).toBe('wt-d')
  })

  it('does not redirect to another host or repo', () => {
    const context = { repoId: 'repo-a', hostId: undefined }
    expect(findOccupiedWorktree([otherHost], '/repo/feature', context)).toBeNull()
    expect(
      findOccupiedWorktree([{ ...local, repoId: 'repo-b' }], '/repo/feature', context)
    ).toBeNull()
  })
})
