import React from 'react'
import { translate } from '@/i18n/i18n'

export function GitGraphStatusErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-3 py-1 text-[11px] text-destructive">
      {translate(
        'auto.components.git.graph.pane.statusReadError',
        'Could not read working tree status: {{value0}}',
        { value0: message }
      )}
    </div>
  )
}
