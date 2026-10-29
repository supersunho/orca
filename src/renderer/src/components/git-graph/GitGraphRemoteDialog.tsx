import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { GitGraphAction } from '../../../../shared/git-graph-actions'

type RemoteMode = 'add' | 'remove' | 'set-url'

export function GitGraphRemoteDialog({
  busy,
  onClose,
  onAction
}: {
  busy: boolean
  onClose: () => void
  onAction: (action: GitGraphAction) => void
}): React.JSX.Element {
  const [mode, setMode] = useState<RemoteMode>('add')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const canSubmit = name.trim().length > 0 && (mode === 'remove' || url.trim().length > 0)

  const submit = (): void => {
    const remoteName = name.trim()
    if (mode === 'remove') {
      onAction({ kind: 'remoteRemove', name: remoteName })
      return
    }
    const remoteUrl = url.trim()
    if (mode === 'add') {
      onAction({ kind: 'remoteAdd', name: remoteName, url: remoteUrl })
      return
    }
    onAction({ kind: 'remoteSetUrl', name: remoteName, url: remoteUrl })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.git.graph.remote.title', 'Remotes')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.git.graph.remote.description',
              'Add, remove, or change the URL of a Git remote.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-xs">
          <label className="grid gap-1">
            <span className="text-muted-foreground">
              {translate('auto.components.git.graph.remote.mode', 'Operation')}
            </span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={mode}
              onChange={(event) =>
                setMode(
                  event.target.value === 'remove'
                    ? 'remove'
                    : event.target.value === 'set-url'
                      ? 'set-url'
                      : 'add'
                )
              }
            >
              <option value="add">
                {translate('auto.components.git.graph.remote.add', 'Add remote')}
              </option>
              <option value="remove">
                {translate('auto.components.git.graph.remote.remove', 'Remove remote')}
              </option>
              <option value="set-url">
                {translate('auto.components.git.graph.remote.setUrl', 'Change URL')}
              </option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-muted-foreground">
              {translate('auto.components.git.graph.remote.name', 'Remote name')}
            </span>
            <Input
              value={name}
              placeholder={translate('auto.components.git.graph.remote.namePlaceholder', 'origin')}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {mode !== 'remove' && (
            <label className="grid gap-1">
              <span className="text-muted-foreground">
                {translate('auto.components.git.graph.remote.url', 'Remote URL')}
              </span>
              <Input
                value={url}
                placeholder={translate(
                  'auto.components.git.graph.remote.urlPlaceholder',
                  'git@github.com:owner/repo.git'
                )}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {translate('auto.components.git.graph.dialog.cancel', 'Cancel')}
          </Button>
          <Button type="button" disabled={busy || !canSubmit} onClick={submit}>
            {translate('auto.components.git.graph.dialog.confirm', 'Run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
