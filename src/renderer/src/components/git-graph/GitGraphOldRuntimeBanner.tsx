import React from 'react'
import { translate } from '@/i18n/i18n'
import type { GitHistoryResult } from '../../../../shared/git-history'

export function isOldRuntimeHistory(result: GitHistoryResult | null): boolean {
  return Boolean(result && result.scope !== 'all-refs')
}

export function GitGraphOldRuntimeBanner(): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-annotation-highlight/30 bg-annotation-highlight/5 px-3 py-1 text-[11px] text-annotation-highlight">
      {translate(
        'auto.components.git.graph.pane.oldRuntime',
        'This runtime does not support the all-branch graph. Showing the current branch only.'
      )}
    </div>
  )
}
