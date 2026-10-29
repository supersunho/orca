import React from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

export function GitGraphWebUnsupported({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
      {translate(
        'auto.components.tab.group.TabGroupPanel.gitGraphDesktopOnly',
        'Git Graph is available in the desktop app.'
      )}
      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        {translate('auto.components.tab.group.TabGroupPanel.closeGitGraph', 'Close Git Graph')}
      </Button>
    </div>
  )
}
