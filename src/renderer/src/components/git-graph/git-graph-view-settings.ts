export const GIT_GRAPH_VIEW_SETTINGS_STORAGE_KEY = 'orca.gitGraph.viewSettings.v1'

export type GitGraphViewSettings = {
  showAuthor: boolean
  showDate: boolean
  relativeDates: boolean
  muteMerges: boolean
}

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function defaultGitGraphViewSettings(): GitGraphViewSettings {
  return { showAuthor: true, showDate: true, relativeDates: false, muteMerges: false }
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
        : defaults.muteMerges
  }
}

export function gitGraphGridTemplate(settings: GitGraphViewSettings): string {
  return [
    '76px',
    'minmax(0,1fr)',
    ...(settings.showAuthor ? ['132px'] : []),
    ...(settings.showDate ? ['96px'] : []),
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
