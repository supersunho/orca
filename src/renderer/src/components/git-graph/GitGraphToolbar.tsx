import React from 'react'
import { Eye, EyeOff, GitBranch, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'

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
    </div>
  )
}
