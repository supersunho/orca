import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  kind: 'pull' | 'push' | 'forcePush'
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  const [acknowledged, setAcknowledged] = useState(false)
  const forcePush = kind === 'forcePush'
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {kind === 'pull'
              ? translate('auto.components.git.graph.sync.pull', 'Pull')
              : forcePush
                ? translate('auto.components.git.graph.sync.forcePush', 'Force push')
                : translate('auto.components.git.graph.sync.push', 'Push')}
          </DialogTitle>
          <DialogDescription>
            {kind === 'pull'
              ? translate(
                  'auto.components.git.graph.sync.pullDescription',
                  'Pull from the upstream branch into this worktree.'
                )
              : forcePush
                ? translate(
                    'auto.components.git.graph.sync.forcePushDescription',
                    'Force push this branch with lease. Remote-only commits may be replaced.'
                  )
                : translate(
                    'auto.components.git.graph.sync.pushDescription',
                    'Push this worktree branch to its remote.'
                  )}
          </DialogDescription>
        </DialogHeader>
        {forcePush && (
          <label className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            {translate(
              'auto.components.git.graph.sync.forcePushAcknowledge',
              'I understand this may replace remote commits.'
            )}
          </label>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {translate('auto.components.git.graph.dialog.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            variant={forcePush ? 'destructive' : 'default'}
            disabled={forcePush && !acknowledged}
            onClick={onConfirm}
          >
            {translate('auto.components.git.graph.dialog.confirm', 'Run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
