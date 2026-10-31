import React from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Archive,
  CloudUpload,
  Eye,
  EyeOff,
  GitBranch,
  Network,
  RefreshCw,
  SlidersHorizontal,
  SquareStack
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuItem,
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
  onForcePush,
  onStash,
  onStashes,
  onBackups,
  onRemotes,
  branches,
  activeBranchFilters,
  onToggleBranchFilter,
  onClearBranchFilters,
  showRemoteBranches,
  onShowRemoteBranchesChange
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
  onForcePush: () => void
  onStash: () => void
  onStashes: () => void
  onBackups: () => void
  onRemotes: () => void
  branches: readonly { name: string; id: string }[]
  activeBranchFilters: readonly string[]
  onToggleBranchFilter: (refId: string) => void
  onClearBranchFilters: () => void
  showRemoteBranches: boolean
  onShowRemoteBranchesChange: (visible: boolean) => void
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
      {(
        [
          ['fetch', onFetch, ArrowDownToLine],
          ['pull', onPull, RefreshCw],
          ['push', onPush, ArrowUpFromLine],
          ['forcePush', onForcePush, CloudUpload]
        ] as const
      ).map(([key, handler, Icon]) => {
        const label = translate(
          `auto.components.git.graph.sync.${key}`,
          { fetch: 'Fetch', pull: 'Pull', push: 'Push', forcePush: 'Force push' }[key] as string
        )
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={label}
                disabled={syncBusy}
                onClick={handler}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {label}
            </TooltipContent>
          </Tooltip>
        )
      })}
      {hasWorkingTreeChanges && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('auto.components.git.graph.sync.stash', 'Stash')}
              disabled={actionBusy}
              onClick={onStash}
            >
              <Archive className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.git.graph.sync.stash', 'Stash')}
          </TooltipContent>
        </Tooltip>
      )}
      {stashCount > 0 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`${translate('auto.components.git.graph.aux.stashes', 'Stashes')} ${stashCount}`}
            onClick={onStashes}
          >
            <SquareStack className="size-4" />
            <span className="text-[11px] tabular-nums">{stashCount}</span>
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
      {branches.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {translate('auto.components.git.graph.pane.branchesLabel', 'Branches:')}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
                aria-label={translate('auto.components.git.graph.pane.branches', 'Branches')}
              >
                {activeBranchFilters.length === 0
                  ? translate('auto.components.git.graph.pane.showAll', 'Show All')
                  : activeBranchFilters.length === 1
                    ? (branches.find((b) => b.id === activeBranchFilters[0])?.name ??
                      activeBranchFilters[0])
                    : `${activeBranchFilters.length}`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-72 min-w-44 overflow-y-auto scrollbar-sleek"
            >
              <DropdownMenuItem
                onSelect={() => {
                  if (activeBranchFilters.length > 0) {
                    onClearBranchFilters()
                  }
                }}
              >
                {translate('auto.components.git.graph.pane.showAll', 'Show All')}
                {activeBranchFilters.length === 0 ? (
                  <span className="ml-auto text-[11px]">✓</span>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {branches.map((branch) => {
                const active = activeBranchFilters.includes(branch.id)
                return (
                  <DropdownMenuItem
                    key={branch.id}
                    onSelect={() => onToggleBranchFilter(branch.id)}
                  >
                    <GitBranch className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{branch.name}</span>
                    {active ? <span className="text-[11px]">✓</span> : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              className="size-3 accent-[var(--primary)]"
              checked={showRemoteBranches}
              onChange={(event) => onShowRemoteBranchesChange(event.target.checked)}
            />
            {translate('auto.components.git.graph.pane.showRemoteBranches', 'Show Remote Branches')}
          </label>
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={translate('auto.components.git.graph.remote.title', 'Remotes')}
            onClick={onRemotes}
          >
            <Network className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {translate('auto.components.git.graph.remote.title', 'Remotes')}
        </TooltipContent>
      </Tooltip>
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
        <DropdownMenuContent align="end" className="w-52">
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
