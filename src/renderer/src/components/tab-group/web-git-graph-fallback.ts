import { useEffect, useRef } from 'react'
import type { Tab } from '../../../../shared/tab-types'

type FallbackTab = Pick<Tab, 'id' | 'entityId' | 'contentType'>

const SAFE_TAB_ORDER: readonly Tab['contentType'][] = [
  'terminal',
  'agent-session',
  'editor',
  'browser'
]

export function findWebGitGraphFallbackTab(tabs: readonly FallbackTab[]): FallbackTab | null {
  for (const contentType of SAFE_TAB_ORDER) {
    const tab = tabs.find((candidate) => candidate.contentType === contentType)
    if (tab) {
      return tab
    }
  }
  return null
}

type FallbackCommands = {
  activateTerminal: (id: string) => void
  activateAgentSession: (id: string) => void
  activateEditor: (id: string) => void
  activateBrowser: (id: string) => void
  newTerminalTab: () => void
}

export function useWebGitGraphFallback({
  active,
  tabs,
  commands
}: {
  active: boolean
  tabs: readonly FallbackTab[]
  commands: FallbackCommands
}): void {
  const requestedRef = useRef(false)
  useEffect(() => {
    if (!active) {
      requestedRef.current = false
      return
    }
    if (requestedRef.current) {
      return
    }
    requestedRef.current = true
    const fallback = findWebGitGraphFallbackTab(tabs)
    if (!fallback) {
      commands.newTerminalTab()
    } else if (fallback.contentType === 'terminal') {
      commands.activateTerminal(fallback.entityId)
    } else if (fallback.contentType === 'agent-session') {
      commands.activateAgentSession(fallback.id)
    } else if (fallback.contentType === 'editor') {
      commands.activateEditor(fallback.id)
    } else if (fallback.contentType === 'browser') {
      commands.activateBrowser(fallback.entityId)
    }
  }, [active, commands, tabs])
}
