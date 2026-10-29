import { describe, expect, it } from 'vitest'
import {
  GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY,
  defaultGitGraphViewSettings,
  gitGraphGridTemplate,
  normalizeGitGraphViewSettings,
  readGitGraphViewSettings,
  writeGitGraphViewSettings
} from './git-graph-view-settings'

function memoryStorage(initial: Record<string, string> = {}): {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  values: Record<string, string>
} {
  const values = { ...initial }
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value
    }
  }
}

describe('git-graph-view-settings', () => {
  it('normalizes invalid and missing fields to defaults', () => {
    expect(normalizeGitGraphViewSettings(null)).toEqual(defaultGitGraphViewSettings())
    expect(
      normalizeGitGraphViewSettings({ showAuthor: false, relativeDates: 'yes', unknown: true })
    ).toEqual({
      showAuthor: false,
      showDate: true,
      relativeDates: false,
      muteMerges: false
    })
  })

  it('persists normalized settings and falls back on corrupt storage', () => {
    const storage = memoryStorage()
    writeGitGraphViewSettings({ ...defaultGitGraphViewSettings(), muteMerges: true }, storage)
    expect(readGitGraphViewSettings(storage).muteMerges).toBe(true)
    expect(JSON.parse(storage.values[GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY])).toEqual({
      showAuthor: true,
      showDate: true,
      relativeDates: false,
      muteMerges: true
    })

    storage.values[GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY] = '{'
    expect(readGitGraphViewSettings(storage)).toEqual(defaultGitGraphViewSettings())
  })

  it('drops grid columns that are hidden', () => {
    expect(
      gitGraphGridTemplate({ ...defaultGitGraphViewSettings(), showAuthor: false, showDate: false })
    ).toBe('76px minmax(0,1fr) 76px')
  })
})
