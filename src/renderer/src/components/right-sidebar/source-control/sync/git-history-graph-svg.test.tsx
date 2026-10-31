import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  buildDefaultGitHistoryColorMap,
  buildGitHistoryViewModels,
  type GitHistoryItemViewModel
} from '../../../../../../shared/git-history-graph'
import type { GitHistoryItem } from '../../../../../../shared/git-history'
import { GitHistoryGraphSvg } from './git-history-graph-svg'

function item(id: string, parentIds: string[]): GitHistoryItem {
  return { id, parentIds, subject: id, message: id }
}

function renderGraph(viewModel: GitHistoryItemViewModel): string {
  return renderToStaticMarkup(<GitHistoryGraphSvg viewModel={viewModel} />)
}

describe('Git history graph rendering', () => {
  it('arcs a two-parent merge from the commit node into the side-parent lane', () => {
    // Production model: merge commit at lane 0, side parent at lane 1.
    const markup = renderGraph({
      historyItem: item('merge', ['first', 'second']),
      kind: 'node',
      inputSwimlanes: [
        { id: 'merge', color: 'git-graph-lane-1' },
        { id: 'second', color: 'git-graph-lane-2' }
      ],
      outputSwimlanes: [
        { id: 'first', color: 'git-graph-lane-1' },
        { id: 'second', color: 'git-graph-lane-2' }
      ]
    })

    // SWIMLANE_WIDTH=11: commit center 11, side-parent center 22.
    expect(markup).toContain('d="M 11 14')
    expect(markup).toContain('A 11 14 0 0 1 22 28')
  })

  it('shifts a surviving lane past a root to its left without changing the root color', () => {
    const markup = renderGraph({
      historyItem: item('root', []),
      kind: 'node',
      inputSwimlanes: [
        { id: 'root', color: 'git-graph-lane-1' },
        { id: 'other', color: 'git-graph-lane-2' }
      ],
      outputSwimlanes: [{ id: 'other', color: 'git-graph-lane-2' }]
    })

    expect(markup).toContain('d="M 22 -1 V 6')
    expect(markup).toContain('cx="11" cy="14" r="3.5" fill="var(--git-graph-lane-1)"')
  })

  it('draws a surviving lane straight past a root to its right', () => {
    const markup = renderGraph({
      historyItem: item('root', []),
      kind: 'node',
      inputSwimlanes: [
        { id: 'other', color: 'git-graph-lane-1' },
        { id: 'root', color: 'git-graph-lane-2' }
      ],
      outputSwimlanes: [{ id: 'other', color: 'git-graph-lane-1' }]
    })

    expect(markup).toContain('d="M 11 -1 V 29"')
    expect(markup).toContain('cx="22" cy="14" r="3.5" fill="var(--git-graph-lane-2)"')
  })

  it('retains a lane in the rendered production model through an unrelated root', () => {
    const rows = buildGitHistoryViewModels([
      item('merge', ['root', 'other']),
      item('root', []),
      item('other', ['base']),
      item('base', [])
    ])
    expect(renderGraph(rows[1]!)).toContain('d="M 22 -1 V 6')
    expect(renderGraph(rows[2]!)).toContain('d="M 11 -1 V 15"')
  })

  it('connects duplicate lanes to one root while shifting the other history', () => {
    const rows = buildGitHistoryViewModels([
      item('merge', ['step', 'other', 'root']),
      item('step', ['root']),
      item('root', []),
      item('other', [])
    ])
    const markup = renderGraph(rows[2]!)

    expect(markup).toContain('d="M 22 -1 V 6')
    expect(markup).toContain('d="M 33 0 A 11 14 0 0 1 22 14 H 11"')
    expect(markup).toContain('cx="11" cy="14" r="3.5" fill="var(--git-graph-lane-1)"')
    expect(renderGraph(rows[3]!)).toContain('d="M 11 -1 V 29"')
  })

  it('keeps adjacent-row vertical lanes continuous across the row boundary', () => {
    // Regression for the reported "lines break between rows": a lane that exits
    // this row at its bottom must re-enter the next row at the same x.
    const rows = buildGitHistoryViewModels([item('child', ['base']), item('base', [])])
    const childSvg = renderGraph(rows[0]!)
    const baseSvg = renderGraph(rows[1]!)

    const exitX = /M (\d+) \d+ V 28/.exec(childSvg)?.[1]
    const entryX = /M (\d+) 0 V 14/.exec(baseSvg)?.[1]
    expect(exitX).toBeTruthy()
    expect(entryX).toBe(exitX)
  })

  it('keeps the normal parent edge when history is truncated before the parent', () => {
    const [row] = buildGitHistoryViewModels([item('tip', ['outside-page'])])
    expect(renderGraph(row!)).toContain('d="M 11 14 V 29"')
  })

  it('keeps incoming and outgoing boundary colors and rings', () => {
    const currentRef = { id: 'refs/heads/feature', name: 'feature', revision: 'tip' }
    const remoteRef = {
      id: 'refs/remotes/origin/feature',
      name: 'origin/feature',
      revision: 'remote'
    }
    const rows = buildGitHistoryViewModels(
      [item('tip', ['base']), item('remote', ['base']), item('base', [])],
      buildDefaultGitHistoryColorMap({ currentRef, remoteRef }),
      currentRef,
      remoteRef,
      undefined,
      true,
      true,
      'base'
    )

    for (const [kind, color] of [
      ['incoming-changes', 'git-graph-remote-ref'],
      ['outgoing-changes', 'git-graph-ref']
    ]) {
      const boundary = rows.find((row) => row.kind === kind)!
      const markup = renderGraph(boundary)
      expect(markup).toContain(`fill="var(--${color})"`)
      expect(markup).toContain('stroke-dasharray="4 2"')
      expect(markup).toContain('V 28"')
    }
  })
})
