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
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import type { GitGraphAction } from '../../../../shared/git-graph-actions'

export type GitGraphDialogRequest =
  | { kind: 'createBranch'; startPoint: string; name: string; checkout: boolean }
  | { kind: 'renameBranch'; name: string }
  | { kind: 'deleteBranch'; name: string; force: boolean }
  | { kind: 'createTag'; target: string; name: string; message: string; push: boolean }
  | {
      kind: 'merge'
      target: string
      noFastForward: boolean
      squash: boolean
      noCommit: boolean
    }
  | { kind: 'rebase'; onto: string; ignoreDate: boolean }
  | { kind: 'reset'; target: string; mode: 'soft' | 'mixed' | 'hard' }
  | {
      kind: 'confirm'
      title: string
      description: string
      acknowledge?: string
      action: GitGraphAction
    }

export function GitGraphActionDialog({
  request,
  busy,
  onCancel,
  onConfirm
}: {
  request: GitGraphDialogRequest
  busy: boolean
  onCancel: () => void
  onConfirm: (action: GitGraphAction) => void
}): React.JSX.Element {
  const [name, setName] = useState('name' in request ? request.name : '')
  const [message, setMessage] = useState('message' in request ? request.message : '')
  const [checkout, setCheckout] = useState('checkout' in request ? request.checkout : false)
  const [force, setForce] = useState('force' in request ? request.force : false)
  const [push, setPush] = useState('push' in request ? request.push : false)
  const [noFastForward, setNoFastForward] = useState(
    'noFastForward' in request ? request.noFastForward : false
  )
  const [squash, setSquash] = useState('squash' in request ? request.squash : false)
  const [noCommit, setNoCommit] = useState('noCommit' in request ? request.noCommit : false)
  const [ignoreDate, setIgnoreDate] = useState('ignoreDate' in request ? request.ignoreDate : false)
  const [resetMode, setResetMode] = useState<'soft' | 'mixed' | 'hard'>(
    'mode' in request ? request.mode : 'mixed'
  )
  const [hardResetAccepted, setHardResetAccepted] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const hardReset = request.kind === 'reset' && resetMode === 'hard'
  const needsAcknowledgment = request.kind === 'confirm' && Boolean(request.acknowledge)

  const submit = (): void => {
    switch (request.kind) {
      case 'createBranch':
        onConfirm({
          kind: 'createBranch',
          name: name.trim(),
          startPoint: request.startPoint,
          checkout
        })
        return
      case 'renameBranch':
        onConfirm({ kind: 'renameBranch', oldName: request.name, newName: name.trim() })
        return
      case 'deleteBranch':
        onConfirm({ kind: 'deleteBranch', name: request.name, force })
        return
      case 'createTag':
        onConfirm({
          kind: 'createTag',
          name: name.trim(),
          target: request.target,
          ...(message.trim() ? { message: message.trim() } : {}),
          push
        })
        return
      case 'merge':
        onConfirm({
          kind: 'merge',
          target: request.target,
          noFastForward,
          squash,
          noCommit
        })
        return
      case 'rebase':
        onConfirm({ kind: 'rebase', onto: request.onto, ignoreDate })
        return
      case 'reset':
        onConfirm({ kind: 'reset', target: request.target, mode: resetMode })
        return
      case 'confirm':
        onConfirm(request.action)
    }
  }

  const needsName =
    request.kind === 'createBranch' ||
    request.kind === 'renameBranch' ||
    request.kind === 'createTag'
  const title =
    request.kind === 'confirm'
      ? request.title
      : translate('auto.components.git.graph.dialog.title', 'Git Graph action')
  const description =
    request.kind === 'confirm'
      ? request.description
      : request.kind === 'reset'
        ? translate(
            'auto.components.git.graph.dialog.resetDescription',
            'Move the current branch to {{value0}}.',
            { value0: request.target.slice(0, 7) }
          )
        : request.kind === 'merge'
          ? translate(
              'auto.components.git.graph.dialog.mergeDescription',
              'Merge {{value0}} into the current branch.',
              {
                value0: request.target
              }
            )
          : request.kind === 'rebase'
            ? translate(
                'auto.components.git.graph.dialog.rebaseDescription',
                'Rebase the current branch onto {{value0}}.',
                {
                  value0: request.onto
                }
              )
            : request.kind === 'deleteBranch'
              ? translate(
                  'auto.components.git.graph.dialog.deleteBranchDescription',
                  'Delete branch {{value0}}.',
                  { value0: request.name }
                )
              : ''

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {needsName && (
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">
              {request.kind === 'createTag'
                ? translate('auto.components.git.graph.dialog.tagName', 'Tag name')
                : translate('auto.components.git.graph.dialog.branchName', 'Branch name')}
            </span>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && name.trim()) {
                  submit()
                }
              }}
            />
          </label>
        )}

        {request.kind === 'createTag' && (
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">
              {translate('auto.components.git.graph.dialog.tagMessage', 'Tag message (optional)')}
            </span>
            <Input value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
        )}

        {request.kind === 'reset' && (
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">
              {translate('auto.components.git.graph.dialog.resetMode', 'Reset mode')}
            </span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={resetMode}
              onChange={(event) =>
                setResetMode(
                  event.target.value === 'hard'
                    ? 'hard'
                    : event.target.value === 'soft'
                      ? 'soft'
                      : 'mixed'
                )
              }
            >
              <option value="soft">
                {translate('auto.components.git.graph.dialog.resetSoft', 'Soft')}
              </option>
              <option value="mixed">
                {translate('auto.components.git.graph.dialog.resetMixed', 'Mixed')}
              </option>
              <option value="hard">
                {translate('auto.components.git.graph.dialog.resetHard', 'Hard')}
              </option>
            </select>
          </label>
        )}

        <div className="grid gap-2 text-xs">
          {request.kind === 'createBranch' && (
            <label className="flex items-center gap-2">
              <Checkbox
                checked={checkout}
                onCheckedChange={(checked) => setCheckout(checked === true)}
              />
              {translate(
                'auto.components.git.graph.dialog.checkoutAfterCreate',
                'Check out after creating'
              )}
            </label>
          )}
          {request.kind === 'deleteBranch' && (
            <label className="flex items-center gap-2">
              <Checkbox checked={force} onCheckedChange={(checked) => setForce(checked === true)} />
              {translate(
                'auto.components.git.graph.dialog.forceDelete',
                'Force delete unmerged branch'
              )}
            </label>
          )}
          {request.kind === 'createTag' && (
            <label className="flex items-center gap-2">
              <Checkbox checked={push} onCheckedChange={(checked) => setPush(checked === true)} />
              {translate(
                'auto.components.git.graph.dialog.pushAfterCreate',
                'Push tag after creating'
              )}
            </label>
          )}
          {request.kind === 'merge' && (
            <>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={noFastForward}
                  onCheckedChange={(checked) => setNoFastForward(checked === true)}
                />
                {translate('auto.components.git.graph.dialog.noFastForward', 'No fast-forward')}
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={squash}
                  onCheckedChange={(checked) => setSquash(checked === true)}
                />
                {translate('auto.components.git.graph.dialog.squash', 'Squash commits')}
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={noCommit}
                  onCheckedChange={(checked) => setNoCommit(checked === true)}
                />
                {translate('auto.components.git.graph.dialog.noCommit', 'Do not commit')}
              </label>
            </>
          )}
          {request.kind === 'rebase' && (
            <label className="flex items-center gap-2">
              <Checkbox
                checked={ignoreDate}
                onCheckedChange={(checked) => setIgnoreDate(checked === true)}
              />
              {translate('auto.components.git.graph.dialog.ignoreDate', 'Ignore author date')}
            </label>
          )}
          {request.kind === 'confirm' && request.acknowledge && (
            <label className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              {request.acknowledge}
            </label>
          )}
          {request.kind === 'reset' && hardReset && (
            <label className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
              <Checkbox
                checked={hardResetAccepted}
                onCheckedChange={(checked) => setHardResetAccepted(checked === true)}
              />
              {translate(
                'auto.components.git.graph.dialog.hardResetWarning',
                'Uncommitted changes will be lost. A backup ref is created before the reset.'
              )}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {translate('auto.components.git.graph.dialog.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            variant={
              (request.kind === 'reset' && resetMode === 'hard') || needsAcknowledgment
                ? 'destructive'
                : 'default'
            }
            disabled={
              busy ||
              (needsName && !name.trim()) ||
              (hardReset && !hardResetAccepted) ||
              (needsAcknowledgment && !acknowledged)
            }
            onClick={submit}
          >
            {translate('auto.components.git.graph.dialog.confirm', 'Run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
