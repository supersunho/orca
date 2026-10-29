import { describe, expect, it } from 'vitest'
import { findWebGitGraphFallbackTab } from './web-git-graph-fallback'

const graph = { id: 'graph', entityId: 'graph', contentType: 'git-graph' as const }

describe('findWebGitGraphFallbackTab', () => {
  it('prefers a terminal, then other supported tabs', () => {
    expect(
      findWebGitGraphFallbackTab([
        graph,
        { id: 'editor', entityId: 'file', contentType: 'editor' },
        { id: 'terminal', entityId: 'pty', contentType: 'terminal' }
      ])?.id
    ).toBe('terminal')
    expect(
      findWebGitGraphFallbackTab([
        graph,
        { id: 'editor', entityId: 'file', contentType: 'editor' },
        { id: 'browser', entityId: 'browser-1', contentType: 'browser' }
      ])?.id
    ).toBe('editor')
  })

  it('returns null for a graph-only group', () => {
    expect(findWebGitGraphFallbackTab([graph])).toBeNull()
  })
})
