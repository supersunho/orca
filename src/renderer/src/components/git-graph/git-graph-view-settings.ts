export const GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY = 'orca.gitGraph.viewSettings.v1'

export type GitGraphViewSettings = {
  showAuthor: boolean
  showDate: boolean
  relativeDates: boolean
  muteMerges: boolean
  authorWidth: number
  dateWidth: number
}

export const GIT_GRAPH_AUTHOR_WIDTH = { min: 80, max: 320, default: 132 } as const
export const GIT_GRAPH_DATE_WIDTH = { min: 72, max: 240, default: 96 } as const

function clampWidth(value: unknown, bounds: { min: number; max: number; default: number }): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(bounds.max, Math.max(bounds.min, Math.round(value)))
    : bounds.default
}

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function defaultGitGraphViewSettings(): GitGraphViewSettings {
  return {
    showAuthor: true,
    showDate: true,
    relativeDates: false,
    muteMerges: false,
    authorWidth: GIT_GRAPH_AUTHOR_WIDTH.default,
    dateWidth: GIT_GRAPH_DATE_WIDTH.default
  }
}

export function normalizeGitGraphViewSettings(value: unknown): GitGraphViewSettings {
  const defaults = defaultGitGraphViewSettings()
  if (value === null || typeof value !== 'object') {
    return defaults
  }
  return {
    showAuthor:
      'showAuthor' in value && typeof value.showAuthor === 'boolean'
        ? value.showAuthor
        : defaults.showAuthor,
    showDate:
      'showDate' in value && typeof value.showDate === 'boolean'
        ? value.showDate
        : defaults.showDate,
    relativeDates:
      'relativeDates' in value && typeof value.relativeDates === 'boolean'
        ? value.relativeDates
        : defaults.relativeDates,
    muteMerges:
      'muteMerges' in value && typeof value.muteMerges === 'boolean'
        ? value.muteMerges
        : defaults.muteMerges,
    authorWidth:
      'authorWidth' in value
        ? clampWidth(value.authorWidth, GIT_GRAPH_AUTHOR_WIDTH)
        : defaults.authorWidth,
    dateWidth:
      'dateWidth' in value ? clampWidth(value.dateWidth, GIT_GRAPH_DATE_WIDTH) : defaults.dateWidth
  }
}

export const GIT_GRAPH_COMPACT_WIDTH_PX = 560

export function effectiveGitGraphViewSettings(
  settings: GitGraphViewSettings,
  width: number | null
): GitGraphViewSettings {
  if (width === null || width <= 0 || width >= GIT_GRAPH_COMPACT_WIDTH_PX) {
    return settings
  }
  return { ...settings, showAuthor: false, showDate: false }
}

export function gitGraphGridTemplate(settings: GitGraphViewSettings): string {
  return [
    '76px',
    'minmax(0,1fr)',
    ...(settings.showAuthor ? [`${settings.authorWidth}px`] : []),
    ...(settings.showDate ? [`${settings.dateWidth}px`] : []),
    '76px'
  ].join(' ')
}

function getStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readGitGraphViewSettings(
  storage: StorageLike | null = getStorage()
): GitGraphViewSettings {
  if (!storage) {
    return defaultGitGraphViewSettings()
  }
  try {
    const raw = storage.getItem(GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY)
    return raw ? normalizeGitGraphViewSettings(JSON.parse(raw)) : defaultGitGraphViewSettings()
  } catch {
    return defaultGitGraphViewSettings()
  }
}

export function writeGitGraphViewSettings(
  settings: GitGraphViewSettings,
  storage: StorageLike | null = getStorage()
): void {
  if (!storage) {
    return
  }
  try {
    storage.setItem(
      GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeGitGraphViewSettings(settings))
    )
  } catch {
    // Preference persistence must never break the graph.
  }
}
