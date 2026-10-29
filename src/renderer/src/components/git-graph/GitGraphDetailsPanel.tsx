import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { GitHistoryItem } from '../../../../shared/git-history'
import type {
  GitBranchChangeEntry,
  GitCommitRangeCompareResult
} from '../../../../shared/git-diff-compare-types'

export type GitGraphRangeCompareState = {
  base: GitHistoryItem
  head: GitHistoryItem
  result: GitCommitRangeCompareResult
  status: 'loading' | 'ready' | 'error'
}

export function GitGraphDetailsPanel({
  selected,
  files,
  filesStatus,
  filesError,
  rangeCompare,
  onClose,
  onOpenDiff,
  onOpenFile,
  onOpenCompareDiff,
  onOpenCompareFile
}: {
  selected: GitHistoryItem | null
  files: GitBranchChangeEntry[]
  filesStatus: 'idle' | 'loading' | 'ready' | 'error'
  filesError: string | null
  rangeCompare: GitGraphRangeCompareState | null
  onClose: () => void
  onOpenDiff: () => void
  onOpenFile: (entry: GitBranchChangeEntry) => void
  onOpenCompareDiff: () => void
  onOpenCompareFile: (entry: GitBranchChangeEntry) => void
}): React.JSX.Element | null {
  if (rangeCompare) {
    return (
      <aside className="flex w-[360px] shrink-0 flex-col border-l border-border">
        <div className="flex items-start gap-2 border-b border-border p-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold">
              {translate('auto.components.git.graph.pane.compareTitle', 'Compare commits')}
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {rangeCompare.base.id.slice(0, 7)}..{rangeCompare.head.id.slice(0, 7)}
            </div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">
              {rangeCompare.base.subject} → {rangeCompare.head.subject}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('auto.components.git.graph.pane.closeDetails', 'Close details')}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            {rangeCompare.status === 'loading'
              ? translate('auto.components.git.graph.pane.comparing', 'Comparing...')
              : `${rangeCompare.result.entries.length} ${translate(
                  'auto.components.git.graph.pane.files',
                  'Files'
                )}`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rangeCompare.status !== 'ready'}
            onClick={onOpenCompareDiff}
          >
            {translate('auto.components.git.graph.pane.openDiff', 'Open commit diff')}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek p-3">
          {rangeCompare.status === 'error' && (
            <div className="text-[11px] text-destructive">
              {rangeCompare.result.summary.errorMessage ??
                translate('auto.components.git.graph.pane.compareFailed', 'Comparison failed.')}
            </div>
          )}
          <div className="space-y-0.5">
            {rangeCompare.result.entries.map((entry) => (
              <button
                key={`${entry.status}:${entry.oldPath ?? ''}:${entry.path}`}
                type="button"
                className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent"
                onClick={() => onOpenCompareFile(entry)}
              >
                <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {entry.status}
                </span>
                <span className="min-w-0 flex-1 truncate">{entry.path}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    )
  }

  if (!selected) {
    return null
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-border">
      <div className="flex items-start gap-2 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{selected.subject}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{selected.id}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {[
              selected.author,
              selected.timestamp ? new Date(selected.timestamp).toLocaleString() : null
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={translate('auto.components.git.graph.pane.closeDetails', 'Close details')}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-sleek p-3">
        <div className="whitespace-pre-wrap break-words text-xs text-foreground/90">
          {selected.message || selected.subject}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            {translate('auto.components.git.graph.pane.files', 'Files')}
            {filesStatus === 'ready' ? ` (${files.length})` : ''}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onOpenDiff}>
            {translate('auto.components.git.graph.pane.openDiff', 'Open commit diff')}
          </Button>
        </div>
        {filesStatus === 'loading' && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {translate('auto.components.git.graph.pane.loadingFiles', 'Loading files...')}
          </div>
        )}
        {filesStatus === 'error' && (
          <div className="mt-2 text-[11px] text-destructive">{filesError}</div>
        )}
        {filesStatus === 'ready' && files.length === 0 && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            {translate('auto.components.git.graph.pane.noFiles', 'No changed files.')}
          </div>
        )}
        <div className="mt-2 space-y-0.5">
          {files.map((entry) => (
            <button
              key={`${entry.status}:${entry.oldPath ?? ''}:${entry.path}`}
              type="button"
              className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent"
              onClick={() => onOpenFile(entry)}
            >
              <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">
                {entry.status}
              </span>
              <span className="min-w-0 flex-1 truncate">{entry.path}</span>
              {entry.added !== undefined || entry.removed !== undefined ? (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  +{entry.added ?? 0} −{entry.removed ?? 0}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
