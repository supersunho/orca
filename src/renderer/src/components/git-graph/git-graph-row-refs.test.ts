import { describe, expect, it } from 'vitest'
import type { GitHistoryItemRef } from '../../../../shared/git-history'
import { selectVisibleGraphRefs } from './git-graph-row-refs'

function ref(
  name: string,
  category: GitHistoryItemRef['category'],
  id = `refs/${category}/${name}`
): GitHistoryItemRef {
  return { id, name, category }
}

describe('selectVisibleGraphRefs', () => {
  it('shows two refs plus the hidden remainder', () => {
    const refs = [ref('main', 'branches'), ref('v1', 'tags'), ref('v2', 'tags')]

    const selected = selectVisibleGraphRefs(refs, [])

    expect(selected.visible.map((item) => item.name)).toEqual(['main', 'v1'])
    expect(selected.hidden.map((item) => item.name)).toEqual(['v2'])
  })

  it('hides a duplicate remote pill unless its filter is active', () => {
    const remote = ref('origin/main', 'remote branches')
    const refs = [ref('main', 'branches'), remote]

    expect(selectVisibleGraphRefs(refs, []).visible.map((item) => item.name)).toEqual(['main'])
    expect(selectVisibleGraphRefs(refs, [remote.id]).visible.map((item) => item.name)).toEqual([
      'main',
      'origin/main'
    ])
  })
})
