import React from 'react'
import { translate } from '@/i18n/i18n'

export function GitGraphFolderEmpty(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-xs text-muted-foreground">
      {translate(
        'auto.components.git.graph.pane.folderWorkspace',
        'Git Graph is only available for Git worktrees.'
      )}
    </div>
  )
}
