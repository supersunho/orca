import { describe, expect, it } from 'vitest'
import { visibleGitGraphTabIds } from './tab-bar-visible-git-graph-tabs'

const tabs = [
  { id: 'graph-1', groupId: 'group-1', contentType: 'git-graph' as const },
  { id: 'graph-2', groupId: 'group-2', contentType: 'git-graph' as const },
  { id: 'terminal-1', groupId: 'group-1', contentType: 'terminal' as const }
]

describe('visibleGitGraphTabIds', () => {
  it('shows only the group Git Graph tabs on desktop', () => {
    expect(visibleGitGraphTabIds(tabs, 'group-1', false)).toEqual(['graph-1'])
  })

  it('hides Git Graph tabs on the web client', () => {
    expect(visibleGitGraphTabIds(tabs, 'group-1', true)).toEqual([])
  })
})
