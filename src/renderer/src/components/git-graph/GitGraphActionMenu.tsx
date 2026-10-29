import React from 'react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import type { GitHistoryItem, GitHistoryItemRef } from '../../../../shared/git-history'

export type GitGraphActionMenuHandlers = {
  onCheckoutCommit: (ref: string) => void
  onCreateBranch: (startPoint: string) => void
  onRenameBranch: (name: string) => void
  onDeleteBranch: (name: string) => void
  onMerge: (target: string) => void
  onRebase: (target: string) => void
  onCherryPick: (commit: string) => void
  onRevert: (commit: string) => void
  onDropCommit: (commit: string) => void
  onReset: (commit: string) => void
  onCreateTag: (target: string) => void
  onDeleteTag: (name: string) => void
  onPushTag: (name: string) => void
  onCompare: (commit: string) => void
}

function copyText(value: string): void {
  void navigator.clipboard.writeText(value)
}

function refsOf(
  item: GitHistoryItem,
  category: GitHistoryItemRef['category']
): GitHistoryItemRef[] {
  return (item.references ?? []).filter((ref) => ref.category === category)
}

export function GitGraphActionMenu({
  item,
  handlers,
  currentBranch
}: {
  item: GitHistoryItem
  handlers: GitGraphActionMenuHandlers
  currentBranch?: string | null
}): React.JSX.Element {
  const branches = refsOf(item, 'branches')
  const tags = refsOf(item, 'tags')
  return (
    <ContextMenuContent className="w-60">
      <ContextMenuItem onSelect={() => handlers.onCompare(item.id)}>
        {translate('auto.components.git.graph.menu.compare', 'Compare with selected')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => handlers.onCheckoutCommit(item.id)}>
        {translate('auto.components.git.graph.menu.checkoutCommit', 'Checkout this commit')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => handlers.onCreateBranch(item.id)}>
        {translate('auto.components.git.graph.menu.createBranchHere', 'Create branch here')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => handlers.onCreateTag(item.id)}>
        {translate('auto.components.git.graph.menu.createTagHere', 'Create tag here')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => handlers.onCherryPick(item.id)}>
        {translate('auto.components.git.graph.menu.cherryPick', 'Cherry-pick commit')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => handlers.onRevert(item.id)}>
        {translate('auto.components.git.graph.menu.revert', 'Revert commit')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => handlers.onDropCommit(item.id)}>
        {translate('auto.components.git.graph.menu.dropCommit', 'Drop commit')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => handlers.onReset(item.id)}>
        {translate('auto.components.git.graph.menu.reset', 'Reset current branch to here')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => copyText(item.id)}>
        {translate('auto.components.git.graph.menu.copyHash', 'Copy commit hash')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => copyText(item.subject)}>
        {translate('auto.components.git.graph.menu.copySubject', 'Copy commit subject')}
      </ContextMenuItem>

      {branches.length > 0 && (
        <>
          <ContextMenuSeparator />
          {branches.map((ref) => (
            <React.Fragment key={ref.id}>
              <ContextMenuItem
                disabled={ref.name === currentBranch}
                onSelect={() => handlers.onCheckoutCommit(ref.name)}
              >
                {translate('auto.components.git.graph.menu.checkoutBranch', 'Checkout {{value0}}', {
                  value0: ref.name
                })}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => handlers.onCreateBranch(ref.name)}>
                {translate(
                  'auto.components.git.graph.menu.createBranchFrom',
                  'Create branch from {{value0}}',
                  { value0: ref.name }
                )}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => handlers.onMerge(ref.name)}>
                {translate(
                  'auto.components.git.graph.menu.mergeIntoCurrent',
                  'Merge {{value0}} into current',
                  {
                    value0: ref.name
                  }
                )}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => handlers.onRebase(ref.name)}>
                {translate(
                  'auto.components.git.graph.menu.rebaseOnto',
                  'Rebase current onto {{value0}}',
                  {
                    value0: ref.name
                  }
                )}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => handlers.onRenameBranch(ref.name)}>
                {translate('auto.components.git.graph.menu.renameBranch', 'Rename {{value0}}', {
                  value0: ref.name
                })}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => handlers.onDeleteBranch(ref.name)}>
                {translate('auto.components.git.graph.menu.deleteBranch', 'Delete {{value0}}', {
                  value0: ref.name
                })}
              </ContextMenuItem>
            </React.Fragment>
          ))}
        </>
      )}

      {tags.length > 0 && (
        <>
          <ContextMenuSeparator />
          {tags.map((ref) => (
            <React.Fragment key={ref.id}>
              <ContextMenuItem onSelect={() => handlers.onPushTag(ref.name)}>
                {translate('auto.components.git.graph.menu.pushTag', 'Push tag {{value0}}', {
                  value0: ref.name
                })}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => handlers.onDeleteTag(ref.name)}>
                {translate('auto.components.git.graph.menu.deleteTag', 'Delete tag {{value0}}', {
                  value0: ref.name
                })}
              </ContextMenuItem>
            </React.Fragment>
          ))}
        </>
      )}
    </ContextMenuContent>
  )
}
