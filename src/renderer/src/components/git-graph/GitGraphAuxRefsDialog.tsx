import React, { useState } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { GitGraphAction, GitGraphAuxRefs } from '../../../../shared/git-graph-actions'

export function GitGraphAuxRefsDialog({
  mode,
  refs,
  busy,
  onClose,
  onAction
}: {
  mode: 'stashes' | 'backups'
  refs: GitGraphAuxRefs
  busy: boolean
  onClose: () => void
  onAction: (action: GitGraphAction) => void
}): React.JSX.Element {
  const [confirmDrop, setConfirmDrop] = useState<number | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'stashes'
              ? translate('auto.components.git.graph.aux.stashes', 'Stashes')
              : translate('auto.components.git.graph.aux.backups', 'Backups')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'stashes'
              ? translate(
                  'auto.components.git.graph.aux.stashesDescription',
                  'Apply, pop, or drop a stash in this worktree.'
                )
              : translate(
                  'auto.components.git.graph.aux.backupsDescription',
                  'Restore a backup ref created before a history-changing action.'
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] min-h-24 overflow-auto scrollbar-sleek">
          {mode === 'stashes' && refs.stashes.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              {translate('auto.components.git.graph.aux.noStashes', 'No stashes.')}
            </div>
          )}
          {mode === 'stashes' &&
            refs.stashes.map((stash) => (
              <div
                key={stash.index}
                className="flex items-center gap-2 border-b border-border/50 px-2 py-1.5 text-xs last:border-b-0"
              >
                <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {stash.index}
                </span>
                <span className="min-w-0 flex-1 truncate" title={stash.message}>
                  {stash.message}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    onAction({ kind: 'stashApply', index: stash.index, reinstateIndex: false })
                  }
                >
                  {translate('auto.components.git.graph.aux.apply', 'Apply')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    onAction({ kind: 'stashPop', index: stash.index, reinstateIndex: false })
                  }
                >
                  {translate('auto.components.git.graph.aux.pop', 'Pop')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={confirmDrop === stash.index ? 'destructive' : 'outline'}
                  disabled={busy}
                  onClick={() => {
                    if (confirmDrop === stash.index) {
                      setConfirmDrop(null)
                      onAction({ kind: 'stashDrop', index: stash.index })
                    } else {
                      setConfirmDrop(stash.index)
                    }
                  }}
                >
                  {confirmDrop === stash.index
                    ? translate('auto.components.git.graph.aux.confirmDrop', 'Confirm drop')
                    : translate('auto.components.git.graph.aux.drop', 'Drop')}
                </Button>
              </div>
            ))}

          {mode === 'backups' && refs.backups.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              {translate('auto.components.git.graph.aux.noBackups', 'No backups.')}
            </div>
          )}
          {mode === 'backups' &&
            refs.backups.map((backup) => (
              <div
                key={backup.ref}
                className="flex items-center gap-2 border-b border-border/50 px-2 py-1.5 text-xs last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[10px]" title={backup.ref}>
                  {backup.ref.replace(/^refs\/orca\/backup\//, '')}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {backup.createdAt ? new Date(backup.createdAt).toLocaleString() : ''}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={confirmRestore === backup.ref ? 'destructive' : 'outline'}
                  disabled={busy}
                  onClick={() => {
                    if (confirmRestore === backup.ref) {
                      setConfirmRestore(null)
                      onAction({ kind: 'restoreBackup', ref: backup.ref })
                    } else {
                      setConfirmRestore(backup.ref)
                    }
                  }}
                >
                  {confirmRestore === backup.ref
                    ? translate('auto.components.git.graph.aux.confirmRestore', 'Confirm restore')
                    : translate('auto.components.git.graph.aux.restore', 'Restore')}
                </Button>
              </div>
            ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="size-3.5" />
            {translate('auto.components.git.graph.dialog.cancel', 'Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
