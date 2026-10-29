import { describe, expect, it } from 'vitest'
import {
  GIT_GRAPH_COMPACT_WIDTH_PX,
  GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY,
  defaultGitGraphViewSettings,
  effectiveGitGraphViewSettings,
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
      muteMerges: false,
      authorWidth: 132,
      dateWidth: 96
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
      muteMerges: true,
      authorWidth: 132,
      dateWidth: 96
    })

    storage.values[GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY] = '{'
    expect(readGitGraphViewSettings(storage)).toEqual(defaultGitGraphViewSettings())
  })

  it('hides author and date columns below the compact breakpoint', () => {
    const settings = defaultGitGraphViewSettings()
    expect(effectiveGitGraphViewSettings(settings, GIT_GRAPH_COMPACT_WIDTH_PX - 1)).toEqual({
      ...settings,
      showAuthor: false,
      showDate: false
    })
    expect(effectiveGitGraphViewSettings(settings, GIT_GRAPH_COMPACT_WIDTH_PX)).toBe(settings)
    expect(effectiveGitGraphViewSettings(settings, 0)).toBe(settings)
  })

  it('clamps persisted widths to their bounds', () => {
    expect(normalizeGitGraphViewSettings({ authorWidth: 5, dateWidth: 999 })).toMatchObject({
      authorWidth: 80,
      dateWidth: 240
    })
  })

  it('drops grid columns that are hidden and uses stored widths', () => {
    expect(
      gitGraphGridTemplate({ ...defaultGitGraphViewSettings(), showAuthor: false, showDate: false })
    ).toBe('76px minmax(0,1fr) 76px')
    expect(
      gitGraphGridTemplate({ ...defaultGitGraphViewSettings(), authorWidth: 180, dateWidth: 120 })
    ).toBe('76px minmax(0,1fr) 180px 120px 76px')
  })
})
