// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { findWebGitGraphFallbackTab, useWebGitGraphFallback } from './web-git-graph-fallback'

const graph = { id: 'graph', entityId: 'graph', contentType: 'git-graph' as const }

describe('findWebGitGraphFallbackTab', () => {
  it('prefers a terminal, then other supported tabs', () => {
    expect(
      findWebGitGraphFallbackTab([
        graph,
        { id: 'editor', entityId: 'file', contentType: 'editor' },
        { id: 'terminal', entityId: 'pty', contentType: 'terminal' }
      ])?.id
    ).toBe('terminal')
    expect(
      findWebGitGraphFallbackTab([
        graph,
        { id: 'editor', entityId: 'file', contentType: 'editor' },
        { id: 'browser', entityId: 'browser-1', contentType: 'browser' }
      ])?.id
    ).toBe('editor')
  })

  it('returns null for a graph-only group', () => {
    expect(findWebGitGraphFallbackTab([graph])).toBeNull()
  })

  it('does not require a terminal for a graph-only group', () => {
    const commands = {
      activateTerminal: vi.fn(),
      activateAgentSession: vi.fn(),
      activateEditor: vi.fn(),
      activateBrowser: vi.fn()
    }
    renderHook(() => useWebGitGraphFallback({ active: true, tabs: [graph], commands }))

    expect(commands.activateTerminal).not.toHaveBeenCalled()
    expect(commands.activateAgentSession).not.toHaveBeenCalled()
    expect(commands.activateEditor).not.toHaveBeenCalled()
    expect(commands.activateBrowser).not.toHaveBeenCalled()
  })

  it('activates a supported fallback once and leaves graph-only groups alone', () => {
    const commands = {
      activateTerminal: vi.fn(),
      activateAgentSession: vi.fn(),
      activateEditor: vi.fn(),
      activateBrowser: vi.fn()
    }
    const terminal = { id: 'terminal', entityId: 'pty', contentType: 'terminal' as const }
    const { rerender } = renderHook(
      ({ active, tabs }) => useWebGitGraphFallback({ active, tabs, commands }),
      { initialProps: { active: true, tabs: [graph, terminal] } }
    )

    expect(commands.activateTerminal).toHaveBeenCalledWith('pty')
    rerender({ active: true, tabs: [graph, terminal] })
    expect(commands.activateTerminal).toHaveBeenCalledTimes(1)

    rerender({ active: true, tabs: [graph] })
    expect(commands.activateEditor).not.toHaveBeenCalled()
    expect(commands.activateTerminal).toHaveBeenCalledTimes(1)
  })
})
