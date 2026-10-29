import { defineFixture } from '../../component-fixtures/component-fixture'
import { GitGraphToolbar } from './GitGraphToolbar'
import { defaultGitGraphViewSettings } from './git-graph-view-settings'

const noop = (): void => undefined

const props = {
  branchLabel: 'main',
  count: 320,
  hasMore: true,
  searchDraft: '',
  onSearchChange: noop,
  loading: false,
  onRefresh: noop,
  syncBusy: false,
  hasWorkingTreeChanges: true,
  actionBusy: false,
  stashCount: 2,
  stashesVisible: true,
  onToggleStashes: noop,
  backupCount: 0,
  viewSettings: defaultGitGraphViewSettings(),
  onToggleViewSetting: noop,
  onFetch: noop,
  onPull: noop,
  onPush: noop,
  onForcePush: noop,
  onStash: noop,
  onStashes: noop,
  onBackups: noop,
  onRemotes: noop
}

export const defaultView = defineFixture({
  width: 900,
  render: () => <GitGraphToolbar {...props} />
})

export const settingsOpen = defineFixture({
  width: 900,
  render: () => <GitGraphToolbar {...props} />,
  interact: (frame) => {
    const trigger = frame.querySelector<HTMLElement>('button[aria-label="Git Graph view settings"]')
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  }
})
