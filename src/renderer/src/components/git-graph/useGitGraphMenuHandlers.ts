import React from 'react'
import { translate } from '@/i18n/i18n'
import type { GitGraphActionMenuHandlers } from './GitGraphActionMenu'
import type { GitGraphDialogRequest } from './GitGraphActionDialog'

export function useGitGraphMenuHandlers({
  setDialogRequest,
  setSelectedIds
}: {
  setDialogRequest: (request: GitGraphDialogRequest | null) => void
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
}): GitGraphActionMenuHandlers {
  return {
    onCheckoutRef: (ref: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.checkoutCommit', 'Checkout this commit'),
        description: translate(
          'auto.components.git.graph.dialog.checkoutDescription',
          'Check out {{value0}}. A dirty working tree blocks the checkout.',
          { value0: ref }
        ),
        action: { kind: 'checkout', branch: ref }
      }),
    onCreateBranch: (startPoint: string) =>
      setDialogRequest({ kind: 'createBranch', startPoint, name: '', checkout: true }),
    onRenameBranch: (name: string) => setDialogRequest({ kind: 'renameBranch', name }),
    onDeleteBranch: (name: string) =>
      setDialogRequest({ kind: 'deleteBranch', name, force: false }),
    onMerge: (target: string) =>
      setDialogRequest({
        kind: 'merge',
        target,
        noFastForward: true,
        squash: false,
        noCommit: false
      }),
    onRebase: (target: string) =>
      setDialogRequest({ kind: 'rebase', onto: target, ignoreDate: true }),
    onCherryPick: (commit: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.cherryPick', 'Cherry-pick commit'),
        description: commit.slice(0, 7),
        action: { kind: 'cherryPick', commit, noCommit: false, recordOrigin: false }
      }),
    onRevert: (commit: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.revert', 'Revert commit'),
        description: commit.slice(0, 7),
        action: { kind: 'revert', commit }
      }),
    onDropCommit: (commit: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.dropCommit', 'Drop commit'),
        description: translate(
          'auto.components.git.graph.dialog.dropCommitDescription',
          'Remove this commit from the current branch. A backup ref is created first.'
        ),
        acknowledge: translate(
          'auto.components.git.graph.dialog.dropCommitAcknowledge',
          'I understand this rewrites the current branch.'
        ),
        action: { kind: 'dropCommit', commit }
      }),
    onReset: (commit: string) => setDialogRequest({ kind: 'reset', target: commit, mode: 'mixed' }),
    onCreateTag: (target: string) =>
      setDialogRequest({ kind: 'createTag', target, name: '', message: '', push: false }),
    onDeleteTag: (name: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.deleteTag', 'Delete tag {{value0}}', {
          value0: name
        }),
        description: translate(
          'auto.components.git.graph.dialog.deleteTagDescription',
          'Delete the tag from this repository.'
        ),
        action: { kind: 'deleteTag', name }
      }),
    onPushTag: (name: string) =>
      setDialogRequest({
        kind: 'confirm',
        title: translate('auto.components.git.graph.menu.pushTag', 'Push tag {{value0}}', {
          value0: name
        }),
        description: translate(
          'auto.components.git.graph.dialog.pushTagDescription',
          'Push the tag to the default remote.'
        ),
        action: { kind: 'pushTag', name }
      }),
    onCompare: (commit: string) =>
      setSelectedIds((previous) =>
        previous.length === 1 && previous[0] !== commit ? [previous[0], commit] : [commit]
      )
  }
}
