import React from 'react'
import { Eye, EyeOff, GitBranch, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { GitGraphViewSettings } from './git-graph-view-settings'

export function GitGraphToolbar({
  branchLabel,
  count,
  hasMore,
  searchDraft,
  onSearchChange,
  loading,
  onRefresh,
  syncBusy,
  hasWorkingTreeChanges,
  actionBusy,
  stashCount,
  stashesVisible,
  onToggleStashes,
  backupCount,
  viewSettings,
  onToggleViewSetting,
  onFetch,
  onPull,
  onPush,
  onStash,
  onStashes,
  onBackups,
  onRemotes
}: {
  branchLabel: string
  count: number
  hasMore: boolean
  searchDraft: string
  onSearchChange: (value: string) => void
  loading: boolean
  onRefresh: () => void
  syncBusy: boolean
  hasWorkingTreeChanges: boolean
  actionBusy: boolean
  stashCount: number
  stashesVisible: boolean
  onToggleStashes: () => void
  backupCount: number
  viewSettings: GitGraphViewSettings
  onToggleViewSetting: (key: keyof GitGraphViewSettings) => void
  onFetch: () => void
  onPull: () => void
  onPush: () => void
  onStash: () => void
  onStashes: () => void
  onBackups: () => void
  onRemotes: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <GitBranch className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-xs font-semibold">
        {translate('auto.components.git.graph.pane.title', 'Git Graph')}
      </span>
      <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={branchLabel}>
        {branchLabel}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {count}
        {hasMore ? '+' : ''}
      </span>
      <Input
        value={searchDraft}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={translate('auto.components.git.graph.pane.search', 'Search all commits')}
        className="ml-auto h-7 w-56"
        aria-label={translate('auto.components.git.graph.pane.search', 'Search all commits')}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={translate('auto.components.git.graph.pane.refresh', 'Refresh Git Graph')}
        onClick={onRefresh}
      >
        <RefreshCw className={loading ? 'animate-spin' : ''} />
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={syncBusy} onClick={onFetch}>
        {translate('auto.components.git.graph.sync.fetch', 'Fetch')}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={syncBusy} onClick={onPull}>
        {translate('auto.components.git.graph.sync.pull', 'Pull')}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={syncBusy} onClick={onPush}>
        {translate('auto.components.git.graph.sync.push', 'Push')}
      </Button>
      {hasWorkingTreeChanges && (
        <Button type="button" variant="ghost" size="sm" disabled={actionBusy} onClick={onStash}>
          {translate('auto.components.git.graph.sync.stash', 'Stash')}
        </Button>
      )}
      {stashCount > 0 && (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onStashes}>
            {translate('auto.components.git.graph.aux.stashes', 'Stashes')} {stashCount}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-pressed={stashesVisible}
            aria-label={translate(
              'auto.components.git.graph.aux.toggleStashRows',
              'Toggle stash rows'
            )}
            onClick={onToggleStashes}
          >
            {stashesVisible ? <Eye /> : <EyeOff />}
          </Button>
        </>
      )}
      {backupCount > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={onBackups}>
          {translate('auto.components.git.graph.aux.backups', 'Backups')} {backupCount}
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onRemotes}>
        {translate('auto.components.git.graph.remote.title', 'Remotes')}
      </Button>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={translate(
                  'auto.components.git.graph.toolbar.viewSettings',
                  'Git Graph view settings'
                )}
              >
                <SlidersHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate('auto.components.git.graph.toolbar.viewSettings', 'Git Graph view settings')}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>
            {translate('auto.components.git.graph.toolbar.viewSettings', 'Git Graph view settings')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={viewSettings.showAuthor}
            onCheckedChange={() => onToggleViewSetting('showAuthor')}
          >
            {translate('auto.components.git.graph.toolbar.showAuthor', 'Author column')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={viewSettings.showDate}
            onCheckedChange={() => onToggleViewSetting('showDate')}
          >
            {translate('auto.components.git.graph.toolbar.showDate', 'Date column')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={viewSettings.relativeDates}
            onCheckedChange={() => onToggleViewSetting('relativeDates')}
          >
            {translate('auto.components.git.graph.toolbar.relativeDates', 'Relative dates')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={viewSettings.muteMerges}
            onCheckedChange={() => onToggleViewSetting('muteMerges')}
          >
            {translate('auto.components.git.graph.toolbar.muteMerges', 'Mute merge commits')}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
