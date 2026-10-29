import React from 'react'
import { translate } from '@/i18n/i18n'
import {
  GIT_GRAPH_AUTHOR_WIDTH,
  GIT_GRAPH_DATE_WIDTH,
  gitGraphGridTemplate,
  type GitGraphViewSettings
} from './git-graph-view-settings'

export type ColumnResizeKey = 'authorWidth' | 'dateWidth'

export function GitGraphTableHeader({
  settings,
  onStartResize,
  onMoveResize,
  onFinishResize,
  onCancelResize,
  onResizeWithKeyboard
}: {
  settings: GitGraphViewSettings
  onStartResize: (key: ColumnResizeKey, event: React.PointerEvent<HTMLSpanElement>) => void
  onMoveResize: (event: React.PointerEvent<HTMLSpanElement>) => void
  onFinishResize: () => void
  onCancelResize: () => void
  onResizeWithKeyboard: (key: ColumnResizeKey, event: React.KeyboardEvent<HTMLSpanElement>) => void
}): React.JSX.Element {
  return (
    <div
      className="grid shrink-0 gap-x-2 border-b border-border bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
      style={{ gridTemplateColumns: gitGraphGridTemplate(settings) }}
    >
      <span />
      <span>{translate('auto.components.git.graph.pane.description', 'Description')}</span>
      {settings.showAuthor && (
        <span className="relative flex min-w-0 items-center">
          {translate('auto.components.git.graph.pane.author', 'Author')}
          <span
            role="separator"
            aria-orientation="vertical"
            aria-label={translate(
              'auto.components.git.graph.pane.resizeAuthor',
              'Resize author column'
            )}
            aria-valuemin={GIT_GRAPH_AUTHOR_WIDTH.min}
            aria-valuemax={GIT_GRAPH_AUTHOR_WIDTH.max}
            aria-valuenow={settings.authorWidth}
            tabIndex={0}
            className="absolute inset-y-0 -right-1 w-2 cursor-col-resize touch-none hover:bg-border"
            onPointerDown={(event) => onStartResize('authorWidth', event)}
            onPointerMove={onMoveResize}
            onPointerUp={onFinishResize}
            onPointerCancel={onCancelResize}
            onKeyDown={(event) => onResizeWithKeyboard('authorWidth', event)}
          />
        </span>
      )}
      {settings.showDate && (
        <span className="relative flex min-w-0 items-center">
          {translate('auto.components.git.graph.pane.date', 'Date')}
          <span
            role="separator"
            aria-orientation="vertical"
            aria-label={translate(
              'auto.components.git.graph.pane.resizeDate',
              'Resize date column'
            )}
            aria-valuemin={GIT_GRAPH_DATE_WIDTH.min}
            aria-valuemax={GIT_GRAPH_DATE_WIDTH.max}
            aria-valuenow={settings.dateWidth}
            tabIndex={0}
            className="absolute inset-y-0 -right-1 w-2 cursor-col-resize touch-none hover:bg-border"
            onPointerDown={(event) => onStartResize('dateWidth', event)}
            onPointerMove={onMoveResize}
            onPointerUp={onFinishResize}
            onPointerCancel={onCancelResize}
            onKeyDown={(event) => onResizeWithKeyboard('dateWidth', event)}
          />
        </span>
      )}
      <span>{translate('auto.components.git.graph.pane.commit', 'Commit')}</span>
    </div>
  )
}
