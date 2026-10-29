import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'

export function GitGraphSyncDialog({
  kind,
  onCancel,
  onConfirm
}: {
  kind: 'pull' | 'push'
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {kind === 'pull'
              ? translate('auto.components.git.graph.sync.pull', 'Pull')
              : translate('auto.components.git.graph.sync.push', 'Push')}
          </DialogTitle>
          <DialogDescription>
            {kind === 'pull'
              ? translate(
                  'auto.components.git.graph.sync.pullDescription',
                  'Pull from the upstream branch into this worktree.'
                )
              : translate(
                  'auto.components.git.graph.sync.pushDescription',
                  'Push this worktree branch to its remote.'
                )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {translate('auto.components.git.graph.dialog.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {translate('auto.components.git.graph.dialog.confirm', 'Run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
