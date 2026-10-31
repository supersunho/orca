// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GitHistoryItemViewModel } from '../../../../../../shared/git-history-graph'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GitHistoryRow } from './git-history-row'

function viewModel(): GitHistoryItemViewModel {
  return {
    historyItem: {
      id: 'commit-a',
      parentIds: [],
      subject: 'subject',
      message: 'subject'
    },
    kind: 'node',
    inputSwimlanes: [{ id: 'commit-a', color: 'git-graph-lane-1' }],
    outputSwimlanes: []
  }
}

// The lane svg is rowPitch(26) tall. The row must be exactly 26px tall too, or
// the svg cannot fill the row and lanes break between adjacent rows.
describe('GitHistoryRow pitch', () => {
  it('declares the row height to match the lane svg pitch (26px, no vertical padding)', () => {
    const rowClassNames = [
      'grid h-[26px] w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 px-3 text-left text-xs transition-colors'
    ]
    expect(rowClassNames[0]).toContain('h-[26px]')
    expect(rowClassNames[0]).not.toContain('py-0.5')
  })

  it('renders the svg with the matching 26px pitch', () => {
    const markup = renderToStaticMarkup(
      <TooltipProvider>
        <GitHistoryRow viewModel={viewModel()} expanded={false} />
      </TooltipProvider>
    )
    expect(markup).toContain('height="26"')
    expect(markup).toContain('cy="13"')
  })
})
