import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { GitGraphConflictState } from './useGitGraphActions'

export function GitGraphConflictBanner({
  conflict,
  reviewCount,
  busy,
  onReview,
  onContinue,
  onSkip,
  onAbort,
  onDismiss
}: {
  conflict: GitGraphConflictState
  reviewCount: number
  busy: boolean
  onReview: () => void
  onContinue: () => void
  onSkip: () => void
  onAbort: () => void
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-annotation-highlight/30 bg-annotation-highlight/5 px-3 py-1.5 text-[11px] text-annotation-highlight">
      <span className="min-w-0 flex-1 truncate">
        {conflict.operation} · {conflict.message}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={reviewCount === 0}
        onClick={onReview}
      >
        {translate('auto.components.git.graph.conflict.review', 'Review')}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onContinue}>
        {translate('auto.components.git.graph.conflict.continue', 'Continue')}
      </Button>
      {(conflict.operation === 'rebase' || conflict.operation === 'cherry-pick') && (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onSkip}>
          {translate('auto.components.git.graph.conflict.skip', 'Skip')}
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onAbort}>
        {translate('auto.components.git.graph.conflict.abort', 'Abort')}
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={translate('auto.components.git.graph.conflict.dismiss', 'Dismiss')}
        onClick={onDismiss}
      >
        <X />
      </Button>
    </div>
  )
}
