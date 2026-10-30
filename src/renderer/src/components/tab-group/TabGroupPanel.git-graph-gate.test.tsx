import { describe, expect, it } from 'vitest'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'

// The menu gate treats only an explicit folder scope as non-Git; bare git
// worktree ids (the E2E/store default) must still expose the entry.
describe('Git Graph create-menu gate', () => {
  it('treats a bare git worktree id as a git workspace', () => {
    expect(parseWorkspaceKey('wt-demo')?.type).not.toBe('folder')
  })
  it('excludes a folder workspace id', () => {
    expect(parseWorkspaceKey('folder:abc')?.type).toBe('folder')
  })
  it('excludes an unparsable id defensively', () => {
    expect(parseWorkspaceKey('')?.type).toBeUndefined()
  })
})
