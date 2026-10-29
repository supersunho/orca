import type { BrowserTab as BrowserTabState } from '../../../../shared/browser-workspace-types'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import type { OpenFile } from '../../store/slices/editor'

export type TabBarItem =
  | {
      type: 'terminal'
      id: string
      unifiedTabId: string
      isPinned: boolean
      data: TerminalTab & { unifiedTabId?: string }
    }
  | {
      type: 'editor'
      id: string
      unifiedTabId: string
      isPinned: boolean
      data: OpenFile & { tabId?: string }
    }
  | {
      type: 'browser'
      id: string
      unifiedTabId: string
      isPinned: boolean
      data: BrowserTabState & { tabId?: string }
    }
  | {
      type: 'simulator'
      id: string
      unifiedTabId: string
      isPinned: boolean
      data: Tab
    }
  | {
      type: 'agent-session'
      id: string
      unifiedTabId: string
      isPinned: boolean
      data: Tab & { contentType: 'agent-session' }
    }
  | {
      type: 'git-graph'
      id: string
      unifiedTabId: string
      isPinned: boolean
      data: Tab
    }
